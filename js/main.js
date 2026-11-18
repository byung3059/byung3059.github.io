/**
 * Main Visual - 3D Card Stack → Project Grid (Three.js)
 *
 * - 서로 다른 각도로 비스듬히 겹쳐 쌓인 카드 더미 (v-w.co.kr 메인 방식), 메인 비주얼엔 6장만 보이고
 *   나머지(= .project .pj_item 개수 - 6)는 6번째 카드 밑에 숨어 있음
 * - 마우스를 올리면 카드들이 부채꼴로 더 벌어지고 화살표 커서가 따라옴
 * - 카드는 넘어가지 않음 (AUTO_SHUFFLE 에 간격을 넣으면 맨 위 카드가 페이드아웃되며 자동으로 넘어가게 할 수 있음)
 * - 카드를 클릭하면 SCROLL DOWN 과 같이 프로젝트 섹션으로 스크롤
 * - 마우스 위치에 따라 더미가 살짝 기울어짐
 * - 스크롤하면 먼저 모든 카드 각도가 똑바로 정렬된 뒤 각 .pj_thumb 자리로 날아가 안착
 *   (진행도 0 = 메인 비주얼 최상단, 1 = .project 상단이 화면 상단에 닿음)
 *   → 도착하면 실제 HTML 썸네일로 교체 (.project 에 is_placed 클래스)
 * - 메인 비주얼에서 스크롤 속도가 빠를수록 카드가 휘고 기울었다가 멈추면 복원 (그리드로 이동할 땐 반듯하게)
 *
 * - .pj_thumb 안에 <img> 를 넣으면 3D 카드에도 같은 이미지가 들어감 (없으면 CARD_COLOR 단색)
 */
import * as THREE from 'three';
import Lenis from 'lenis';
import { initSphere } from './sphere.js';

// ─── Lenis (부드러운 스크롤) ────────────────────────────
function initLenis() {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

	const lenis = new Lenis({
		duration: 1.2,
		easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
	});

	return lenis;
}

const lenis = initLenis();

// ─── 프레임 루프 하나로 통일 ────────────────────────────
// Lenis 스크롤을 먼저 갱신한 뒤 카드를 그려야 카드와 HTML 썸네일 위치가 같은 프레임 기준으로 맞음
// (루프가 둘이면 순서가 엇갈려 한 프레임씩 밀리며 덜컹거림)
const tickers = [];

function tick(time) {
	if (lenis) lenis.raf(time);
	for (const fn of tickers) fn(time);
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ─── Settings ───────────────────────────────────────────
const DEFAULT_COUNT = 10; // .pj_item 이 없을 때 카드 수
const CARD_BASE_W = 100; // 카드 기본 크기 (월드 단위, 실제 크기는 scale 로 맞춤)
const CARD_BASE_H = 125; // 4:5 = .pj_thumb 비율과 같게
const CARD_SEGMENTS = 24; // 휘어짐 표현용 분할 수
const CARD_BEND_RADIUS = 90; // 스크롤 속도로 휠 때 곡률 반지름
const CAMERA_FOV = 30;

// 카드 더미 크기 : 카드 가로 = min(화면 가로 × 비율, 화면 세로 × STACK_MAX_H)
// v-w.co.kr 기준 : 1440×900 에서 카드 약 486×615px (화면 높이의 약 68%)
const STACK_WIDTH = { pc: 0.34, tablet: 0.5, mobile: 0.8 };
const STACK_MAX_H = 0.55;
const STACK_UP = 0.02; // 화면 가운데보다 위로 (화면 높이 대비)

// 메인 비주얼에 보이는 6장의 순서(위 → 아래)별 기울기(도)와 어긋난 위치(카드 가로 대비)
// 맨 위 카드는 똑바로, 아래로 갈수록 같은 방향으로 10도씩 일정하게 틀어짐 (위치 어긋남 없음)
// 나머지 카드는 6번째 카드 밑에 숨어 있다가 스크롤하면 함께 그리드로 이동
const STACK_SLOTS = [
	{ rot: 0, x: 0, y: 0 },
	{ rot: 10, x: 0, y: 0 },
	{ rot: 20, x: 0, y: 0 },
	{ rot: 30, x: 0, y: 0 },
	{ rot: 40, x: 0, y: 0 },
	{ rot: 50, x: 0, y: 0 },
];
const VISIBLE_CARDS = STACK_SLOTS.length;
const STACK_TILT = 5; // 카드 더미 전체를 오른쪽(시계 방향)으로 기울이는 각도(도)
const STACK_DEPTH = 4; // 층 사이 간격 (px)
const STACK_SHADE = 0.06; // 아래층일수록 어두워지는 정도 (6장 → 맨 아래 30% 어둡게)
const HOVER_SPREAD = 0.3; // 호버 시 더 벌어지는 정도 (0.3 = 각도가 30% 더 벌어짐)
const HOVER_SCALE = 1.04;
const HOVER_LERP = 0.08;
const SHUFFLE_DURATION = 800; // 한 장 넘어가는 시간(ms)
const FADE_OUT_PART = 0.55; // 넘김 시간 중 맨 위 카드가 페이드아웃되는 구간 (나머지 구간에 다음 카드가 올라오며 맨 아래 카드가 페이드인)
const FADE_OUT_SCALE = 0.06; // 맨 위 카드가 사라지며 살짝 커지는 정도
const AUTO_SHUFFLE = 0; // 자동으로 넘어가는 간격(ms), 0 이면 끔
// 인트로 : 메인 비주얼 카드가 아래 카드부터 한 장씩 위에서 떨어지며 쌓임 (initIntro 가 시작)
const INTRO_STAGGER = 160; // 카드 사이 시간차(ms)
const INTRO_DURATION = 900; // 한 장이 내려앉는 시간(ms)
const INTRO_DROP = 0.5; // 떨어지기 시작하는 높이 (카드 가로 대비)
const INTRO_ROT = -8; // 떨어지며 풀리는 추가 기울기(도)
const INTRO_SCALE = 0.06; // 떨어지며 작아지는 정도
const CLICK_MOVE_LIMIT = 8; // 누른 뒤 이만큼(px) 넘게 움직였다 놓으면 클릭(스크롤 이동)으로 치지 않음

const STRAIGHTEN_END = 0.15; // 스크롤 진행도 이 지점까지 카드 각도·어긋남이 똑바로 정렬됨
const MORPH_STAGGER = 0; // 그리드로 갈 때 카드별 출발 시간차 (0 = 전부 동시에 펼쳐짐)
// 그리드로 내려갈 때 : 원통 카드처럼 휘면서 오른쪽으로 크게 돌아 들어감 (이동 중간에 최대, 도착하면 반듯하게)
const MORPH_SWEEP = 0.16; // 오른쪽으로 돌아가는 거리 (화면 가로 대비)
const MORPH_YAW = 0.5; // 오른쪽으로 돌아보는 각도 (라디안)
const MORPH_BEND = 0.75; // 휘어지는 정도 (0 ~ 1)

// 인터랙션
const MOUSE_TILT = 0.15; // 마우스 기울기 최대 각도 (라디안)
const MOUSE_LERP = 0.06;
const SCROLL_VEL_LERP = 0.15;
const LEAN_K = 0.006; // 스크롤 속도(px/프레임) → 앞뒤 기울기
const LEAN_MAX = 0.3;
const BEND_K = 0.012; // 스크롤 속도 → 카드 휘어짐
const BEND_MAX = 0.5;

const CARD_COLOR = 0xdddddd; // 이미지 없는 카드 색 (scss $card-bg 와 동일)

// ─── Utils ──────────────────────────────────────────────
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const degToRad = THREE.MathUtils.degToRad;

// ─── 카드 Geometry : 평면 ↔ 휜 면 정점을 둘 다 보관 ─────
function createCardGeometry() {
	const geo = new THREE.PlaneGeometry(CARD_BASE_W, CARD_BASE_H, CARD_SEGMENTS, 1);
	const pos = geo.attributes.position;
	const flat = Float32Array.from(pos.array);
	const curved = new Float32Array(flat.length);

	for (let i = 0; i < flat.length; i += 3) {
		const angle = flat[i] / CARD_BEND_RADIUS;
		curved[i] = CARD_BEND_RADIUS * Math.sin(angle);
		curved[i + 1] = flat[i + 1];
		curved[i + 2] = CARD_BEND_RADIUS * (Math.cos(angle) - 1);
	}

	geo.userData = { flat, curved, flatness: 1 };
	return geo;
}


// 0 = 휜 면, 1 = 평면
function setFlatness(geo, t) {
	const data = geo.userData;
	if (Math.abs(data.flatness - t) < 0.0001) return;

	const arr = geo.attributes.position.array;
	for (let i = 0; i < arr.length; i++) {
		arr[i] = data.curved[i] + (data.flat[i] - data.curved[i]) * t;
	}

	geo.attributes.position.needsUpdate = true;
	geo.computeBoundingSphere();
	data.flatness = t;
}

// ─── Texture : 이미지 비율 유지(cover) ──────────────────
function fitCover(texture, planeAspect) {
	const img = texture && texture.image;
	if (!img || !img.width) return;

	const imgAspect = img.width / img.height;

	if (imgAspect > planeAspect) {
		texture.repeat.set(planeAspect / imgAspect, 1);
		texture.offset.set((1 - texture.repeat.x) / 2, 0);
	} else {
		texture.repeat.set(1, imgAspect / planeAspect);
		texture.offset.set(0, (1 - texture.repeat.y) / 2);
	}
}

// ─── Init ───────────────────────────────────────────────
// viewport : 카드 캔버스(화면 고정, 클릭 통과) / project : 그리드 섹션
// hero : 호버·클릭을 받는 메인 비주얼 / cursorEls : 카드 위에서 따라오는 커서 [화살표 원, 회전 글자 링]
function initCardStack(viewport, project, hero, cursorEls = []) {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const items = project ? [...project.querySelectorAll('.pj_item')] : [];
	const thumbs = items.map((item) => item.querySelector('.pj_thumb'));
	const count = thumbs.length || DEFAULT_COUNT;

	// JS 동작 시에만 썸네일을 숨겼다가 3D 카드 도착 후 노출
	if (project) project.classList.add('js_morph');

	// Scene / Camera / Renderer (z=0 평면에서 1unit = 1px)
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 1, 20000);
	const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setClearColor(0x000000, 0);
	viewport.appendChild(renderer.domElement);

	// 더미 기준 좌표계 : 화면 가운데 + 마우스·스크롤 기울기
	const stackGroup = new THREE.Group();
	scene.add(stackGroup);

	let vw = 1;
	let vh = 1;
	let cardW = 1; // 더미 카드 가로(px)

	// 캔버스 크기 맞춤 : 크기가 그대로면 아무것도 안 함
	// (setSize 는 캔버스를 비우므로, 쓸데없이 부르면 한 프레임 빈 화면 = 깜빡임)
	let lastW = 0;
	let lastH = 0;
	function layout() {
		const w = viewport.clientWidth;
		const h = viewport.clientHeight;
		if (w === lastW && h === lastH) return;
		lastW = w;
		lastH = h;
		vw = w;
		vh = h;

		camera.aspect = vw / vh;
		camera.position.z = vh / 2 / Math.tan(degToRad(CAMERA_FOV / 2));
		camera.updateProjectionMatrix();
		renderer.setSize(vw, vh);

		// 구간 판단은 CSS 미디어쿼리와 같은 기준(스크롤바 포함 창 너비)
		const winW = window.innerWidth;
		const factor = winW > 1024 ? STACK_WIDTH.pc : winW > 768 ? STACK_WIDTH.tablet : STACK_WIDTH.mobile;
		// 카드 가로는 8px 배수 → 4:5 세로도 짝수 px
		cardW = Math.floor(Math.min(vw * factor, vh * STACK_MAX_H) / 8) * 8;
		stackGroup.position.set(0, Math.round((vh * STACK_UP) / 2) * 2, 0);
	}
	layout();
	let pendingLayout = false; // 크기가 바뀌면 다음 프레임 그리기 직전에 맞춤 (맞춘 그 프레임에 바로 다시 그려서 빈 화면이 안 보이게)

	// Cards
	// 이미지는 ImageBitmap 으로 미리(메인 스레드 밖에서) 디코딩 → GPU 에 올릴 때 디코딩 때문에 화면이 멈추지 않게
	// (ImageBitmap 은 위아래가 이미 뒤집힌 채 디코딩하므로 texture.flipY = false)
	const textureLoader = new THREE.ImageBitmapLoader();
	textureLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
	// GPU 업로드 : 12장을 한꺼번에 올리면 화면이 1초씩 멈춤 → 메인 비주얼에 보이는 6장만 먼저(인트로가 기다림),
	// 나머지는 인트로가 끝난 뒤 브라우저가 한가할 때 한 장씩 (uploadRest)
	const textureLoads = []; // 먼저 올릴 6장이 다 올라가면 끝나는 Promise 들
	const laterTextures = []; // 나중에 올릴 텍스처
	let uploadRestStarted = false;
	const uploadNext = () => {
		const tex = laterTextures.shift();
		if (!tex) return;
		if (tex.image) renderer.initTexture(tex);
		const next = () => uploadNext();
		if ('requestIdleCallback' in window) requestIdleCallback(next, { timeout: 500 });
		else setTimeout(next, 100);
	};
	const cards = [];
	const meshes = [];

	for (let i = 0; i < count; i++) {
		const geometry = createCardGeometry();

		const img = thumbs[i] && thumbs[i].querySelector('img');
		const src = img && (img.currentSrc || img.src);

		let texture = null;
		if (src) {
			const early = i < VISIBLE_CARDS;
			let done = () => {};
			if (early) textureLoads.push(new Promise((resolve) => (done = resolve)));
			texture = new THREE.Texture();
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.flipY = false;
			const tex = texture;
			textureLoader.load(
				src,
				(bitmap) => {
					tex.image = bitmap;
					tex.needsUpdate = true;
					fitCover(tex, CARD_BASE_W / CARD_BASE_H);
					// 숨어 있던 카드가 처음 보일 때 이미지를 한꺼번에 GPU 로 올리며 멈추는 것 방지 → 로드되자마자 미리 올려둠
					if (early) renderer.initTexture(tex);
					else {
						laterTextures.push(tex);
						if (uploadRestStarted && laterTextures.length === 1) uploadNext();
					}
					done();
				},
				undefined,
				() => done()
			);
		}

		// 겹침 순서는 거리(z)가 아니라 renderOrder(= 더미 순서)로만 정함 → depthTest/depthWrite 끔
		// (이동 중엔 카드 z 가 거의 같아져서 거리로 정렬하면 사진이 서로 앞뒤로 뒤바뀜)
		const baseColor = new THREE.Color(texture ? 0xffffff : CARD_COLOR);
		const frontMat = new THREE.MeshBasicMaterial({
			map: texture,
			color: baseColor.clone(),
			side: THREE.FrontSide,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		});
		const backMat = new THREE.MeshBasicMaterial({
			color: CARD_COLOR,
			side: THREE.BackSide,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		});

		const frontMesh = new THREE.Mesh(geometry, frontMat);
		const backMesh = new THREE.Mesh(geometry, backMat);

		const group = new THREE.Group();
		group.add(frontMesh, backMesh);
		scene.add(group);

		const card = {
			index: i,
			group,
			geometry,
			frontMesh,
			backMesh,
			frontMat,
			backMat,
			baseColor,
			thumb: thumbs[i] || null,
			slot: i, // 목표 순서 (0 = 맨 위)
			slotFrom: i, // 넘김 시작 때 순서
			slotCur: i, // 현재 순서 (slotFrom → slot 으로 이징)
			fading: false, // 맨 위에서 페이드아웃 후 맨 아래로 가는 중
		};
		frontMesh.userData.card = card;

		cards.push(card);
		meshes.push(frontMesh);
	}

	// State
	let hoverCur = 0;
	let introStart = Infinity; // 인트로 카드 쌓기 시작 시각 (그 전엔 카드 안 보임)
	let introEnd = Infinity;
	const introDone = () => performance.now() >= introEnd;
	let isHovering = false;
	let progress = 0;
	let isPlaced = false;
	let lastShuffle = performance.now(); // 마지막 넘김 시작 시각 (자동 넘김 간격 + 넘김 애니메이션 기준)


	let lastScrollY = window.scrollY;
	let scrollVel = 0;
	const mouseTarget = new THREE.Vector2();
	const mouseCur = new THREE.Vector2();

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const canvas = renderer.domElement;

	// 재사용 객체
	const zAxis = new THREE.Vector3(0, 0, 1);
	const localPos = new THREE.Vector3();
	const localQuat = new THREE.Quaternion();
	const localScale = new THREE.Vector3();
	const localMatrix = new THREE.Matrix4();
	const worldMatrix = new THREE.Matrix4();
	const fromPos = new THREE.Vector3();
	const fromQuat = new THREE.Quaternion();
	const fromScale = new THREE.Vector3();
	const flatQuat = new THREE.Quaternion(); // 정면(회전 없음)
	const yAxis = new THREE.Vector3(0, 1, 0);
	const yawQuat = new THREE.Quaternion();

	function pickCard(clientX, clientY) {
		const rect = canvas.getBoundingClientRect();
		pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObjects(meshes)[0];
		return hit ? hit.object.userData.card : null;
	}

	function getProgress() {
		if (!project) return 0;
		const start = project.getBoundingClientRect().top + window.scrollY;
		return start > 0 ? clamp(window.scrollY / start) : 0;
	}

	function setPlaced(placed) {
		if (placed === isPlaced) return;
		isPlaced = placed;
		if (project) project.classList.toggle('is_placed', placed);
		viewport.style.visibility = placed ? 'hidden' : '';
	}

	// 다음 카드로 : 맨 위 카드는 페이드아웃 후 맨 아래로, 나머지는 한 칸씩 올라오고 새로 보이는 카드는 페이드인
	function shuffle() {
		const now = performance.now();
		if (now - lastShuffle < SHUFFLE_DURATION) return; // 넘기는 중엔 무시
		for (const card of cards) {
			card.slotFrom = card.slot;
			card.fading = card.slot === 0;
			card.slot = card.fading ? count - 1 : card.slot - 1;
		}
		lastShuffle = now;
	}

	function setCursor(show, x, y) {
		for (const el of cursorEls) {
			el.classList.toggle('is_show', show);
			if (x !== undefined) el.style.translate = `${x}px ${y}px`;
		}
	}

	// Animation Loop
	function animate(now) {
		// 인트로에서 카드 쌓기가 시작되기 전엔 화면에 그릴 카드가 없으므로 렌더 생략 (h1 등장 연출이 버벅이지 않게)
		if (introStart === Infinity) return;

		if (pendingLayout) {
			pendingLayout = false;
			layout();
		}

		progress = getProgress();

		// 스크롤 속도 (px/프레임, 부드럽게)
		const scrollY = window.scrollY;
		scrollVel = lerp(scrollVel, scrollY - lastScrollY, SCROLL_VEL_LERP);
		lastScrollY = scrollY;

		// 스크롤이 시작되면 호버 해제 (한 번에 그리드까지 내려가도 커서가 남지 않게 안착 처리보다 먼저)
		const interactive = progress === 0;
		if (!interactive && isHovering) {
			isHovering = false;
			if (hero) hero.style.cursor = '';
			setCursor(false);
		}

		// 그리드 안착 완료 → 실제 HTML 썸네일로 교체하고 렌더링 생략
		setPlaced(progress >= 1);
		if (isPlaced) return;

		// 자동 넘김 : 맨 위에서 호버하지 않을 때만
		if (AUTO_SHUFFLE && !reduceMotion && interactive && !isHovering && now - lastShuffle > AUTO_SHUFFLE) {
			shuffle();
		}

		// 인터랙션 값 : 호버 벌어짐 + 마우스 기울기 + 스크롤 속도(앞뒤 기울기·휘어짐)
		hoverCur += ((isHovering ? 1 : 0) - hoverCur) * HOVER_LERP;
		mouseCur.lerp(mouseTarget, MOUSE_LERP);
		const lean = clamp(scrollVel * LEAN_K, -LEAN_MAX, LEAN_MAX);
		const bend = clamp(Math.abs(scrollVel) * BEND_K, 0, BEND_MAX);

		// 스크롤 시작 구간 : 각도·어긋남·마우스 기울기가 0 으로 → 카드가 똑바로 정렬된 뒤 그리드로 이동
		const straight = easeInOutCubic(clamp(progress / STRAIGHTEN_END));
		const loose = 1 - straight;

		// 스크롤 속도 기울기도 정렬되면서 사라짐 (이동 중엔 반듯하게)
		stackGroup.rotation.set(
			(mouseCur.y * MOUSE_TILT + lean) * loose,
			mouseCur.x * MOUSE_TILT * loose,
			degToRad(-STACK_TILT) * loose // 더미 전체를 오른쪽으로 기울임 (스크롤 정렬 구간에서 0 으로)
		);
		stackGroup.updateMatrixWorld(true);

		const spread = (1 + hoverCur * HOVER_SPREAD) * loose;
		const baseScale = (cardW / CARD_BASE_W) * (1 + hoverCur * (HOVER_SCALE - 1));
		const morphRange = 1 - STRAIGHTEN_END - MORPH_STAGGER * (count - 1);

		// 넘김 진행도 : raw = 시간 비율, moveT = 이징 (올라오는 카드용)
		const raw = clamp((now - lastShuffle) / SHUFFLE_DURATION);
		const moveT = easeInOutCubic(raw);

		for (const card of cards) {
			let opacity;
			let scale = baseScale;

			if (card.fading && raw < FADE_OUT_PART) {
				// 맨 위 카드 : 제자리에서 살짝 커지며 페이드아웃
				const f = raw / FADE_OUT_PART;
				card.slotCur = card.slotFrom;
				opacity = 1 - f;
				scale *= 1 + f * FADE_OUT_SCALE;
			} else {
				// 나머지 : 한 칸씩 올라옴 (사라진 카드는 맨 아래로 순간 이동 — 숨겨진 자리라 보이지 않음)
				card.slotCur = card.fading ? card.slot : lerp(card.slotFrom, card.slot, moveT);
				if (card.fading && raw >= 1) card.fading = false;
				// 6번째 아래는 숨김, 6번째 자리로 올라오는 카드는 페이드인
				opacity = clamp(VISIBLE_CARDS - card.slotCur);
			}

			// 순서(소수) 사이를 보간한 기울기·위치 (6번째 아래 카드는 6번째와 같은 자리)
			const slotPos = Math.min(card.slotCur, VISIBLE_CARDS - 1);
			const s0 = Math.floor(slotPos);
			const s1 = Math.min(s0 + 1, VISIBLE_CARDS - 1);
			const sf = slotPos - s0;
			const a = STACK_SLOTS[s0];
			const b = STACK_SLOTS[s1];
			const rot = lerp(a.rot, b.rot, sf) * spread;
			const ox = lerp(a.x, b.x, sf) * spread * cardW;
			const oy = lerp(a.y, b.y, sf) * spread * cardW;

			// 인트로 : 보이는 6장은 아래 카드부터 차례로 위에서 떨어지며 내려앉음 (drop 1 = 아직 위, 0 = 제자리)
			let intro = 1;
			if (card.slot < VISIBLE_CARDS) {
				const order = VISIBLE_CARDS - 1 - card.slot;
				intro = easeOutCubic(clamp((now - introStart - order * INTRO_STAGGER) / INTRO_DURATION));
			}
			const drop = 1 - intro;
			opacity *= intro;

			localPos.set(ox, oy + drop * cardW * INTRO_DROP, (count - card.slotCur) * STACK_DEPTH);
			localQuat.setFromAxisAngle(zAxis, degToRad(rot + drop * INTRO_ROT));
			localScale.set(scale * (1 + drop * INTRO_SCALE), scale * (1 + drop * INTRO_SCALE), 1);
			localMatrix.compose(localPos, localQuat, localScale);
			worldMatrix.multiplyMatrices(stackGroup.matrixWorld, localMatrix);
			worldMatrix.decompose(fromPos, fromQuat, fromScale);

			// 그리드로 이동 진행도 (카드별 시간차)
			const t = card.thumb
				? easeInOutCubic(clamp((progress - STRAIGHTEN_END - card.index * MORPH_STAGGER) / morphRange))
				: 0;
			let flatness = 1 - bend * 0.6 * loose;

			if (t === 0) {
				card.group.position.copy(fromPos);
				card.group.quaternion.copy(fromQuat);
				card.group.scale.copy(fromScale);
			} else {
				// 썸네일의 화면 위치(px) → z=0 평면의 월드 좌표
				const r = card.thumb.getBoundingClientRect();
				const tx = r.left + r.width / 2 - vw / 2;
				const ty = vh / 2 - (r.top + r.height / 2);
				const arc = Math.sin(Math.PI * t); // 이동 중간에 최대

				card.group.position.set(
					lerp(fromPos.x, tx, t) + arc * vw * MORPH_SWEEP,
					lerp(fromPos.y, ty, t),
					lerp(fromPos.z, 0, t)
				);
				card.group.quaternion.slerpQuaternions(fromQuat, flatQuat, t);
				yawQuat.setFromAxisAngle(yAxis, arc * MORPH_YAW);
				card.group.quaternion.premultiply(yawQuat);
				flatness = 1 - arc * MORPH_BEND;
				card.group.scale.set(
					lerp(fromScale.x, r.width / CARD_BASE_W, t),
					lerp(fromScale.y, r.height / CARD_BASE_H, t),
					1
				);
			}

			setFlatness(card.geometry, clamp(flatness));

			// 아래층일수록 어둡게 (정렬 구간에서 전부 같은 색으로)
			const shade = lerp(1 - Math.min(card.slotCur, VISIBLE_CARDS - 1) * STACK_SHADE, 1, straight);
			card.frontMat.color.copy(card.baseColor).multiplyScalar(shade);

			// 숨어 있던 카드는 정렬 구간에서 미리 보이게 (맨 위 카드 뒤라 안 보이다가 펼쳐질 때 자연스럽게 등장)
			// 그리는 순서 : 더미 아래 카드부터 → 맨 위 카드가 마지막 (이동 중에도 메인 비주얼 순서 그대로 유지)
			// 같은 카드 안에선 뒷면 먼저, 앞면 나중
			const order = (count - card.slotCur) * 2;
			card.backMesh.renderOrder = order;
			card.frontMesh.renderOrder = order + 1;

			const alpha = Math.max(opacity, straight);
			card.frontMat.opacity = alpha;
			card.backMat.opacity = alpha;
			card.group.visible = alpha > 0.001;
		}

		renderer.render(scene, camera);
	}

	tickers.push(animate);

	// Pointer (mouse + touch 공통)
	// 캔버스는 화면 위를 덮고 있어서 클릭을 통과시키고(CSS pointer-events: none),
	// 대신 메인 비주얼에서 이벤트를 받음 → SCROLL DOWN 같은 링크도 클릭 가능
	const zone = hero || canvas;
	const isLink = (e) => e.target instanceof Element && e.target.closest('a, button');

	window.addEventListener('pointermove', (e) => {
		if (e.pointerType === 'mouse') {
			// 마우스 기울기 (-1 ~ 1)
			mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);

			// 카드 위 호버 → 벌어짐 + 화살표 커서
			const over = progress === 0 && introDone() && zone.contains(e.target) && !isLink(e) && !!pickCard(e.clientX, e.clientY);
			if (over !== isHovering) {
				isHovering = over;
				zone.style.cursor = over ? 'none' : '';
			}
			setCursor(over, e.clientX, e.clientY);
		}
	});

	// 누른 위치 기억 → 끌다가 놓은 건 클릭으로 치지 않음
	let downX = 0;
	let downY = 0;
	zone.addEventListener('pointerdown', (e) => {
		downX = e.clientX;
		downY = e.clientY;
	});

	// 카드 클릭 → SCROLL DOWN 과 같이 프로젝트 섹션으로 스크롤 (카드는 넘어가지 않음)
	zone.addEventListener('click', (e) => {
		if (progress > 0 || !introDone() || isLink(e)) return;
		if (Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_MOVE_LIMIT) return;
		if (pickCard(e.clientX, e.clientY)) scrollToProject();
	});

	// 마우스가 창 밖으로 나가면 기울기·커서 원위치
	document.documentElement.addEventListener('mouseleave', () => {
		mouseTarget.set(0, 0);
		setCursor(false);
	});

	// Resize : 화면 크기가 바뀌면 다음 프레임 그리기 직전에 캔버스 크기 맞춤 (animate)
	new ResizeObserver(() => {
		pendingLayout = true;
	}).observe(viewport);

	// 보이는 6장이 GPU 에 올라가고, 카드 셰이더도 미리 컴파일한 뒤(첫 렌더 때 멈춤 방지) 결과가 반영된(2 프레임 뒤) 시점
	const ready = Promise.all(textureLoads).then(() => {
		renderer.compile(scene, camera);
		return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});

	return {
		ready,
		// 나머지 카드 이미지를 한가할 때 한 장씩 GPU 에 올림 (인트로가 끝난 뒤 호출)
		uploadRest() {
			if (uploadRestStarted) return;
			uploadRestStarted = true;
			uploadNext();
		},
		// 카드 쌓기 시작 → 끝날 때까지 걸리는 시간(ms) 반환, skip 이면 바로 다 쌓인 상태
		playIntro(skip = false) {
			if (skip || reduceMotion) {
				introStart = introEnd = -Infinity;
				return 0;
			}
			const total = (VISIBLE_CARDS - 1) * INTRO_STAGGER + INTRO_DURATION;
			introStart = performance.now();
			introEnd = introStart + total;
			return total;
		},
	};
}

const mvCarousel = document.getElementById('mvCarousel');
let cardStack = null;
if (mvCarousel) {
	cardStack = initCardStack(
		mvCarousel,
		document.getElementById('project'),
		document.querySelector('.main_visual'),
		[document.getElementById('mvCursor'), document.getElementById('mvCursorRing')].filter(Boolean)
	);
}

/**
 * Main Visual - SCROLL DOWN
 */
// 프로젝트 섹션으로 부드럽게 이동 (카드 → 그리드 연출이 보이도록 천천히) : SCROLL DOWN · 카드 클릭 공통
function scrollToProject() {
	const target = document.getElementById('project');
	if (!target) return;
	if (lenis) lenis.scrollTo(target, { duration: 2.4 });
	else target.scrollIntoView({ behavior: 'smooth' });
}

function initHeroInfo() {
	const scrollBtn = document.getElementById('mvScroll');
	if (scrollBtn) {
		scrollBtn.addEventListener('click', (e) => {
			e.preventDefault();
			scrollToProject();
		});
	}
}

initHeroInfo();

/**
 * Project 아래 여백 = 메인 비주얼 h1 윗선부터 화면 바닥까지 거리
 * - 카드가 다 지나가고 about 이 드러나기 직전, 뒤에 고정된 DETAIL ORIENTED 가 잘리지 않고 통째로 보이게
 * - 화면 크기·글꼴 로딩에 따라 h1 크기가 바뀌므로 그때마다 다시 계산 → .project 의 --mv-title-space (짝수 px)
 */
function initTitleSpace() {
	const hero = document.querySelector('.main_visual');
	// h1 은 flex: 1 로 세로를 다 차지하고 글자는 아래에 붙어 있으므로, 실제 글자 윗선은 첫 줄(DETAIL) 기준
	const title = document.querySelector('.mv_title > span');
	const project = document.getElementById('project');
	if (!hero || !title || !project) return;

	const update = () => {
		const space = hero.getBoundingClientRect().bottom - title.getBoundingClientRect().top;
		project.style.setProperty('--mv-title-space', `${Math.ceil(space / 2) * 2}px`);
	};

	update();
	document.fonts.ready.then(update);
	new ResizeObserver(update).observe(hero);
}

initTitleSpace();

/**
 * About - 진입하면 유리 구체가 또렷하게 보였다가 어두워지며 글이 나타나고, 스크롤한 만큼 글자가 한 자씩 채워짐
 * - 섹션(400vh)이 지나가는 동안 글은 화면 가운데 고정(sticky)
 * - 진행도 0 = 섹션 상단이 화면 가운데에 닿음, 1 = 섹션이 끝나 고정이 풀림
 * - 이후 마지막 한 화면을 스크롤하는 동안 푸터(ABOUT)가 화면 가운데 그 자리에서 투명도 0 → 1 로 나타남, 구체는 뒤에 계속 남음
 *
 *   ENTER  : 구체만 또렷하게(투명도 1), 글은 아직 안 보임
 *   SETTLE : 구체가 어두워지고, 글(흐린 상태)이 나타남
 *   FILL   : 글자가 앞에서부터 한 자씩 채워짐
 *   HOLD   : 다 채워진 글을 잠깐 그대로 보여줌
 *   OUT    : 글이 투명도로 사라지고(고정이 풀리기 전에 다 사라짐 → 글이 위로 밀려 올라가지 않음), 구체는 푸터 뒤 자리로 조금 더 어둡게
 */
const ABOUT_DIM = 0.16; // 채워지기 전 글자 투명도 (scss .ab_char 와 같게)
const ABOUT_SOFT = 8; // 채워지는 경계를 몇 글자에 걸쳐 부드럽게 할지
const ABOUT_SETTLE = [0.2, 0.32]; // 0 ~ 0.2 는 구체만 또렷하게 보이는 진입 구간
const ABOUT_FILL = [0.32, 0.78];
const ABOUT_OUT = [0.84, 0.98]; // 0.78 ~ 0.84 는 다 채워진 채 머묾
const FOOTER_FADE = 0.6; // about 이 끝난 뒤 화면 높이의 이 비율만큼 스크롤하는 동안 푸터가 나타남
const ABOUT_BG = { full: 1, dim: 0.5, rest: 0.4 }; // 구체 투명도 : 진입 / 글 있을 때 / 푸터 뒤

const phase = (p, [from, to]) => easeInOutCubic(clamp((p - from) / (to - from)));

function initAbout() {
	const section = document.getElementById('about');
	const textEl = document.getElementById('abText');
	const bgEl = document.getElementById('abSphere');
	const footerEl = document.querySelector('.footer');
	if (!section || !textEl) return;

	// 글자 단위로 span 나누기 (줄바꿈 <br> 은 그대로, 공백은 채우기 순서에서 제외)
	const chars = [];
	const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
	const textNodes = [];
	while (walker.nextNode()) textNodes.push(walker.currentNode);

	for (const node of textNodes) {
		const frag = document.createDocumentFragment();
		for (const ch of node.textContent.replace(/\s+/g, ' ')) {
			if (ch === ' ') {
				frag.append(' ');
				continue;
			}
			const span = document.createElement('span');
			span.className = 'ab_char';
			span.textContent = ch;
			frag.append(span);
			chars.push({ el: span, value: ABOUT_DIM });
		}
		node.replaceWith(frag);
	}

	// 모션 줄이기 설정이면 처음부터 다 채움
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		for (const c of chars) c.el.style.opacity = 1;
		return;
	}

	// 푸터는 about 위에 겹쳐 고정되어 있으므로 처음엔 숨김 (JS 가 없으면 그냥 보임)
	const setFooter = (v) => {
		if (!footerEl) return;
		footerEl.style.opacity = v;
		footerEl.style.pointerEvents = v > 0.5 ? '' : 'none';
	};
	setFooter(0);

	const total = chars.length;

	tickers.push(() => {
		const rect = section.getBoundingClientRect();
		const vh = window.innerHeight;
		const range = section.offsetHeight - vh + vh / 2;
		const progress = clamp((vh / 2 - rect.top) / range);
		// 글자 채우기
		const pos = clamp((progress - ABOUT_FILL[0]) / (ABOUT_FILL[1] - ABOUT_FILL[0])) * (total + ABOUT_SOFT);

		for (let i = 0; i < total; i++) {
			const t = clamp((pos - i) / ABOUT_SOFT);
			const value = Math.round((ABOUT_DIM + (1 - ABOUT_DIM) * t) * 100) / 100;
			if (value !== chars[i].value) {
				chars[i].value = value;
				chars[i].el.style.opacity = value;
			}
		}

		// 구체 투명도 : 진입 땐 또렷하게 → 글이 나타나며 어두워짐 → 푸터 자리로 조금 더 어둡게
		const settle = phase(progress, ABOUT_SETTLE);
		const out = phase(progress, ABOUT_OUT);

		let bg = lerp(ABOUT_BG.full, ABOUT_BG.dim, settle);
		bg = lerp(bg, ABOUT_BG.rest, out);

		// 글 : 구체가 어두워질 때 나타나고, 다 채워진 뒤 사라짐
		textEl.style.opacity = settle * (1 - out);

		if (bgEl) bgEl.style.opacity = bg;

		// 푸터 : about 이 끝난 뒤(섹션 바닥이 화면 바닥을 지나면) 그 자리에서 나타남
		setFooter(easeInOutCubic(clamp((vh - rect.bottom) / (vh * FOOTER_FADE))));
	});
}

initAbout();

// About · 푸터 배경 : 계속 접히며 일렁이는 검은 유리 구체 (js/sphere.js)
// 준비(WebGL · 조명 환경맵 굽기)가 무거워서 페이지를 열자마자 하면 인트로가 1초 가까이 멈춤
// → 인트로가 끝난 뒤 브라우저가 한가할 때 준비 (initIntro 가 호출)
// 구체 캔버스는 화면에 고정이라 항상 보이는 것으로 잡히므로, 래퍼(.ab_wrap)가 화면에 있을 때만 렌더링
let aboutSphereStarted = false;
function initAboutSphere() {
	const abSphere = document.getElementById('abSphere');
	if (!abSphere || aboutSphereStarted) return;
	aboutSphereStarted = true;
	const start = () => initSphere(abSphere, { observe: document.querySelector('.ab_wrap') || abSphere });
	if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
	else setTimeout(start, 300);
}

/**
 * Intro - 첫 입장 연출 (빈 화면에서 시작)
 * 1. h1(DETAIL ORIENTED) 각 줄이 넓게 벌어진 자간에서 제자리로 모이며 서서히 나타남 (투명도 + 자간, scss Intro 의 CSS 전환)
 * 2. 동시에 : 로고(헤더) + 오른쪽 © 2026 · SCROLL DOWN 이 아래에서 살짝 올라오며 나타나고,
 *    메인 비주얼 카드가 아래 카드부터 한 장씩 떨어지며 쌓임 (initCardStack 의 playIntro)
 * - 연출 중엔 스크롤·카드 호버를 막음
 * - 페이지 중간에서 새로고침했거나 모션 줄이기 설정이면 건너뜀
 * - 처음 깜빡임 방지 : index.html <head> 의 인라인 스크립트가 <html> 에 is_intro 클래스를 먼저 붙여 둠 (scss Intro 참고)
 */
const INTRO = {
	blank: 300, // 처음 빈 화면(ms)
	title: 1300, // h1 등장 시작 → 로고·오른쪽 정보 등장 + 카드 쌓기 시작까지 (h1 전환은 1.6s 라 끝부분과 살짝 겹침)
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 페이지 스크롤바가 실제로 차지하는 폭을 재서 --sbw 로 → 인트로 · 메뉴 중 html overflow hidden 으로 사라진 자리를 그만큼 비워 둠 (scss)
// (잠깐 스크롤바를 강제로 띄워 창 폭 - 문서 폭으로 잼 : 휴대폰처럼 스크롤바가 화면 위에 떠서 자리를 안 차지하면 0
//  — 테스트용 div 로 재면 휴대폰에서도 4px 가 나와 인트로가 끝날 때 화면 폭이 바뀌며 깜빡였음)
function measureScrollbar() {
	const root = document.documentElement;
	const prev = root.style.overflowY;
	root.style.overflowY = 'scroll';
	const sbw = Math.max(0, window.innerWidth - root.clientWidth);
	root.style.overflowY = prev;
	root.style.setProperty('--sbw', `${sbw}px`);
}

async function initIntro() {
	const root = document.documentElement;
	measureScrollbar();
	const title = document.querySelector('.mv_title');
	const skip = !title || window.scrollY > 10 || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const finish = () => root.classList.remove('is_intro', 'intro_fill', 'intro_ui');

	if (skip) {
		finish();
		if (cardStack) {
			cardStack.playIntro(true);
			cardStack.uploadRest();
		}
		initAboutSphere();
		return;
	}


	// 연출 중 스크롤 막기 : html.is_intro { overflow: hidden } (scss) + 휠·터치·스크롤 키도 막음
	// 휠은 Lenis(window 에서 받음)보다 먼저 document 캡처 단계에서 멈춤 (Lenis 가 스크롤 값을 바꾸지 않게)
	const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
	const blockScroll = (e) => {
		e.preventDefault();
		e.stopPropagation();
	};
	const blockKeys = (e) => {
		if (SCROLL_KEYS.includes(e.key)) blockScroll(e);
	};
	const blockOptions = { passive: false, capture: true };
	document.addEventListener('wheel', blockScroll, blockOptions);
	document.addEventListener('touchmove', blockScroll, blockOptions);
	document.addEventListener('keydown', blockKeys, true);

	let cardsStarted = false;
	try {
		// 글꼴 + 카드 이미지 GPU 업로드가 끝난 뒤 시작 (업로드 중엔 화면이 1초씩 멈춰서 h1 연출이 끊김)
		// 느린 환경에서 너무 오래 빈 화면이지 않게 최대 4초까지만 기다림
		await document.fonts.ready;
		await Promise.race([cardStack ? cardStack.ready : null, wait(4000)]);
		await wait(INTRO.blank);
		// h1 : 투명 + 넓은 자간 → 제자리 (CSS 전환)
		root.classList.add('intro_fill');
		await wait(INTRO.title);

		root.classList.add('intro_ui');
		cardsStarted = true;
		await wait(cardStack ? cardStack.playIntro() : 0);
	} finally {
		// 중간에 오류가 나도 화면이 비어 있지 않게 : 클래스 정리 + 카드 바로 다 쌓인 상태로
		finish();
		if (cardStack && !cardsStarted) cardStack.playIntro(true);
		// 인트로가 끝난 뒤 : 나머지 카드 이미지 업로드 → 유리 구체 준비 (둘 다 한가할 때)
		if (cardStack) cardStack.uploadRest();
		initAboutSphere();
		document.removeEventListener('wheel', blockScroll, blockOptions);
		document.removeEventListener('touchmove', blockScroll, blockOptions);
		document.removeEventListener('keydown', blockKeys, true);
	}
}

initIntro();

/**
 * Menu - 헤더 MENU 버튼 → 화면 전체 흐린 유리판 + 섹션 이동 링크 (휴대폰은 아래에서 올라오는 시트)
 * - 열려 있는 동안 스크롤 막기 (Lenis 정지 + html.is_menu, 스크롤바 자리 보정은 인트로와 같은 --sbw)
 * - 링크를 누르면 닫히고 해당 섹션으로 부드럽게 이동 / Esc 로 닫기
 */
function initMenu() {
	const btn = document.getElementById('menuBtn');
	const gnb = document.getElementById('gnb');
	if (!btn || !gnb) return;
	const root = document.documentElement;

	const setOpen = (open) => {
		root.classList.toggle('is_menu', open);
		btn.textContent = open ? 'CLOSE' : 'MENU';
		btn.setAttribute('aria-expanded', String(open));
		if (lenis) open ? lenis.stop() : lenis.start();
	};

	btn.addEventListener('click', () => {
		if (root.classList.contains('is_intro')) return; // 인트로 중엔 무시
		setOpen(!root.classList.contains('is_menu'));
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && root.classList.contains('is_menu')) setOpen(false);
	});

	for (const link of gnb.querySelectorAll('a[data-target]')) {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			setOpen(false);
			const id = link.dataset.target;
			// Intro : 맨 위 / Contact : 맨 아래(푸터는 화면에 겹쳐 고정이라 페이지 끝으로) / Project : 섹션 시작
			// About : 섹션 시작이면 구체만 보이는 진입 구간이라, 글이 다 나타나고 채워지기 직전(ABOUT_SETTLE 끝)으로
			let target;
			if (id === 'top') target = 0;
			else if (id === 'contact') target = document.documentElement.scrollHeight;
			else if (id === 'about') {
				const section = document.getElementById('about');
				const vh = window.innerHeight;
				const range = section.offsetHeight - vh + vh / 2; // initAbout 의 progress 계산과 같음
				target = section.getBoundingClientRect().top + window.scrollY + ABOUT_SETTLE[1] * range - vh / 2;
			} else target = document.getElementById(id);
			if (target === null) return;
			if (lenis) lenis.scrollTo(target, { duration: 2 });
			else {
				const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
				window.scrollTo({ top, behavior: 'smooth' });
			}
		});
	}
}

initMenu();
