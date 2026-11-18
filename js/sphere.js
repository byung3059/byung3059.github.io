/**
 * Glass Sphere - 검은 유리 구체가 쉬지 않고 리본처럼 접히며 일렁이는 애니메이션 (Three.js)
 *
 * - 검은 배경 + 광택 있는 검은 구체, 가장자리에 반사광이 맺히고 무지갯빛(iridescence)이 흐름
 * - 구 표면을 셰이더에서 변형 : 두 겹의 꼬인 띠(리본)가 서로 다른 축·속도로 계속 흘러감
 *   → 축 자체도 천천히 돌아서 접히는 방향이 계속 바뀜, 접힘 깊이도 숨 쉬듯 커졌다 작아짐 (완전히 멈추지 않음)
 * - 반사는 가상의 스튜디오 조명(흰 소프트박스 + 무지개 띠 여러 개)을 환경맵으로 구워서 사용
 * - 블룸(빛 번짐)으로 반사광이 은은하게 빛남
 * - 마우스 위치에 따라 살짝 기울어짐
 *
 * 사용 : initSphere(컨테이너 요소) → 컨테이너 크기에 맞춰 캔버스 생성
 *        컨테이너가 화면 밖에 있으면 렌더링을 멈춤 (성능)
 *        initSphere(컨테이너, { observe: 요소 }) → 컨테이너가 화면에 고정(fixed)일 때, 대신 이 요소가 보일 때만 렌더링
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ─── Settings ───────────────────────────────────────────
const SEGMENTS = 256; // 구 분할 수 (높을수록 접힘이 매끈)

// 접힘 : 두 겹의 리본 (A = 큰 주름, B = 반대로 꼬이는 잔주름)
const FOLD_A = { amount: 0.26, bands: 3, twist: 4, speed: 1.0 };
const FOLD_B = { amount: 0.12, bands: 2, twist: -3, speed: 1.4 };
const FOLD_SHARP = 0.85; // 접힘 모서리 날카로움 (1 = 부드러운 물결, 작을수록 각진 주름)
const AXIS_DRIFT = 0.6; // 접힘 축이 흔들리는 정도 (0 = 고정)
const WOBBLE = 0.08; // 전체가 일렁이는 정도

// 접힘 깊이가 숨 쉬듯 커졌다 작아짐 (최소값이 0 이 아니라 계속 움직임)
const BREATH_CYCLE = 8; // 한 주기(초)
const BREATH_MIN = 0.45;
const BREATH_MAX = 1;

const SPIN = { x: 0.07, y: 0.22 }; // 자전 속도 (라디안/초) — 두 축으로 돌아서 반사가 계속 바뀜
const MOUSE_TILT = 0.25; // 마우스 기울기 최대 각도 (라디안)
const MOUSE_LERP = 0.04;

// 블룸 (빛 번짐)
const BLOOM = { strength: 0.45, radius: 0.4, threshold: 0.8 };

const CAMERA_FOV = 30;
const SPHERE_FILL = 0.62; // 화면 짧은 변 대비 구 지름

// ─── 스튜디오 환경맵 : 검은 공간에 흰 조명판 + 무지개 띠 → 구 가장자리에 선명한 반사광 ─────
function createStudio() {
	const studio = new THREE.Scene();
	studio.background = new THREE.Color(0x000000);
	const rainbow = createRainbowTexture();

	const addPanel = (w, h, pos, intensity, map = null) => {
		const mat = new THREE.MeshBasicMaterial({
			color: new THREE.Color(0xffffff).multiplyScalar(intensity),
			map,
			side: THREE.DoubleSide,
			toneMapped: false,
		});
		const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
		panel.position.copy(pos);
		panel.lookAt(0, 0, 0);
		studio.add(panel);
	};

	addPanel(7, 2.4, new THREE.Vector3(-0.5, 5, 1.5), 4); // 위 소프트박스 (구 윗부분 큰 반사)
	addPanel(7, 0.6, new THREE.Vector3(-0.5, 3.6, 2.6), 4, rainbow); // 소프트박스 바로 아래 무지개 띠
	addPanel(0.5, 7, new THREE.Vector3(-5, 0.5, 1.5), 2.2); // 왼쪽 세로 스트립
	addPanel(0.6, 7, new THREE.Vector3(-4.2, 0.5, 3), 3, rainbow); // 왼쪽 무지개 스트립
	addPanel(0.35, 6, new THREE.Vector3(5, -0.5, 0.5), 1.6); // 오른쪽 세로 스트립
	addPanel(0.5, 6, new THREE.Vector3(4.4, -0.5, -1.5), 2.6, rainbow); // 오른쪽 뒤 무지개 스트립
	addPanel(5, 0.4, new THREE.Vector3(1, -4.5, 2), 1); // 아래 가는 띠
	addPanel(6, 0.5, new THREE.Vector3(-1, -3.8, -2.5), 2, rainbow); // 아래 뒤 무지개 띠
	addPanel(14, 14, new THREE.Vector3(0, 0, -7), 0.08); // 뒤쪽 어두운 회색 벽 (구 외곽선에 은은한 테두리)

	return studio;
}

// 가로 무지개 그라데이션 (빨 → 노 → 초 → 파 → 보)
function createRainbowTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 1;
	const ctx = canvas.getContext('2d');
	const grad = ctx.createLinearGradient(0, 0, 256, 0);
	['#ff3b3b', '#ffb03b', '#e8ff3b', '#3bff8a', '#3bc4ff', '#5a3bff', '#c03bff'].forEach((c, i, arr) =>
		grad.addColorStop(i / (arr.length - 1), c)
	);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 256, 1);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

// ─── 셰이더 : 구 → 리본 변형 + 변형된 면의 법선 다시 계산 ─────
const f = (n) => n.toFixed(3);

const DISPLACE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uMorph;

// 축을 따라 꼬인 띠 : sin 을 날카롭게 → 접힌 주름 (축 양끝(극)은 꼬임이 모이지 않게 약하게)
float ribbon(vec3 p, vec3 axis, float bands, float twist, float speed) {
	float h = dot(p, axis);
	vec3 radial = p - axis * h;
	float ring = length(radial);
	vec3 b1 = normalize(cross(axis, abs(axis.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
	vec3 b2 = cross(axis, b1);
	float theta = atan(dot(radial, b2), dot(radial, b1));
	float s = sin(theta * bands + h * twist - uTime * speed);
	s = sign(s) * pow(abs(s), ${f(FOLD_SHARP)});
	return s * smoothstep(0.0, 0.6, ring);
}

vec3 displaceSphere(vec3 p) {
	float d = ${f(AXIS_DRIFT)};
	vec3 axisA = normalize(vec3(0.35 + sin(uTime * 0.23) * d, 1.0, 0.2 + cos(uTime * 0.17) * d));
	vec3 axisB = normalize(vec3(1.0, cos(uTime * 0.19) * d, sin(uTime * 0.29) * d - 0.3));

	float a = ribbon(p, axisA, ${f(FOLD_A.bands)}, ${f(FOLD_A.twist)}, ${f(FOLD_A.speed)});
	float b = ribbon(p, axisB, ${f(FOLD_B.bands)}, ${f(FOLD_B.twist)}, ${f(FOLD_B.speed)});
	float wobble = sin(dot(p, axisA) * 6.0 + uTime * 1.1) * 0.5 + 0.5;

	float r = 1.0 + uMorph * (${f(FOLD_A.amount)} * a + ${f(FOLD_B.amount)} * b + ${f(WOBBLE)} * wobble);
	return normalize(p) * r;
}
`;

const NORMAL_GLSL = /* glsl */ `
vec3 sphereDir = normalize(position);
vec3 sphereT = normalize(cross(sphereDir, abs(sphereDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
vec3 sphereB = cross(sphereDir, sphereT);
float sphereEps = 0.002;
vec3 displaced = displaceSphere(position);
vec3 displacedT = displaceSphere(normalize(position + sphereT * sphereEps));
vec3 displacedB = displaceSphere(normalize(position + sphereB * sphereEps));
vec3 objectNormal = normalize(cross(displacedT - displaced, displacedB - displaced));
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

// ─── Init ───────────────────────────────────────────────
export function initSphere(container, { observe = container } = {}) {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setClearColor(0x000000, 1);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	container.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);

	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(createStudio(), 0.02).texture;
	pmrem.dispose();

	// 검은 유리 : 정면은 거의 검고, 비스듬한 가장자리에서 반사 + 무지갯빛
	const uniforms = { uTime: { value: 0 }, uMorph: { value: BREATH_MIN } };
	const material = new THREE.MeshPhysicalMaterial({
		color: 0x050505,
		metalness: 0,
		roughness: 0.05,
		clearcoat: 1,
		clearcoatRoughness: 0.03,
		iridescence: 1,
		iridescenceIOR: 1.8,
		iridescenceThicknessRange: [100, 1200],
		envMapIntensity: 1.4,
	});

	material.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uniforms.uTime;
		shader.uniforms.uMorph = uniforms.uMorph;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\n${DISPLACE_GLSL}`)
			.replace('#include <beginnormal_vertex>', NORMAL_GLSL)
			.replace('#include <begin_vertex>', 'vec3 transformed = displaced;');
	};

	const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, SEGMENTS, SEGMENTS), material);
	scene.add(sphere);

	// 후처리 : 렌더 → 블룸 → 톤매핑·색공간 출력
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
	composer.addPass(bloomPass);
	composer.addPass(new OutputPass());

	// 크기 : 컨테이너 짧은 변 대비 SPHERE_FILL 만큼
	function layout() {
		const w = container.clientWidth;
		const h = container.clientHeight;
		renderer.setSize(w, h);
		composer.setPixelRatio(renderer.getPixelRatio());
		composer.setSize(w, h);
		camera.aspect = w / h;
		// 지름 2 인 구가 짧은 변의 SPHERE_FILL 을 차지하도록 카메라 거리 계산
		const fovY = THREE.MathUtils.degToRad(CAMERA_FOV);
		const shortFill = SPHERE_FILL * Math.min(1, w / h);
		camera.position.z = 1 / Math.tan(fovY / 2) / shortFill;
		camera.updateProjectionMatrix();
	}
	layout();
	new ResizeObserver(layout).observe(container);

	// 마우스 기울기
	const mouseTarget = new THREE.Vector2();
	const mouseCur = new THREE.Vector2();
	window.addEventListener('pointermove', (e) => {
		mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
	});

	const breathAt = (t) => {
		const wave = 0.5 - 0.5 * Math.cos((t / BREATH_CYCLE) * Math.PI * 2);
		return THREE.MathUtils.lerp(BREATH_MIN, BREATH_MAX, wave);
	};

	const clock = new THREE.Clock();

	function animate() {
		const t = reduceMotion ? 0 : clock.getElapsedTime();
		uniforms.uTime.value = t;
		uniforms.uMorph.value = breathAt(t);

		mouseCur.lerp(mouseTarget, MOUSE_LERP);
		sphere.rotation.set(t * SPIN.x + mouseCur.y * MOUSE_TILT, t * SPIN.y + mouseCur.x * MOUSE_TILT, 0);

		composer.render();
	}
	// 화면에 보일 때만 렌더링
	new IntersectionObserver(([entry]) => {
		renderer.setAnimationLoop(entry.isIntersecting ? animate : null);
	}).observe(observe);

	return { renderer, sphere, uniforms };
}
