// DOM 콘텐츠가 완전히 로드된 후 스크립트를 실행
window.addEventListener("DOMContentLoaded", () => {
    // 커버 애니메이션
    $(function () {
        CustomEase.create("myEase", "0.96, 0.02, 0.22, 0.96");
        const coverTimeline = gsap.timeline({
            delay: 0.5
        });
        coverTimeline
            .to(".cover_start_bg", {
                xPercent: -100,
                duration: 0.8,
                ease: "myEase"
            })
            .add(() => {
                // 여기서 CSS 애니메이션이 실행되도록 클래스 추가
                document.querySelector("#cover_ani .cube")
                    .classList.add("animate-cube");
            })
            .fromTo("#cover_ani .txt_box p span",
                { yPercent: 100, opacity: 0 },
                { yPercent: 0, delay: 0.75, opacity: 1, duration: 1, ease: "power2.out", stagger: 0.1 }
            )
            .to("#cover_ani .cube",
                {
                    rotate: 0,
                    delay: 0,
                    duration: 2,
                    ease: "myEase"
                }
            )
            .to("#cover_ani", {
                opacity: 0,
                duration: 1,
            })
            .set(["#cover_ani"], {
                display: "none"
            })
            .add(() => {
                document.querySelector("#project_sec .itm_intro .cube_wrap .cube").classList.add("animate-cube");
                document.querySelector("body").classList.remove("cover");
            });

    });
    // 커버 애니메이션

    // 레니스 스크롤
    $(function () {
        const lenis = new Lenis({
            smooth: true,
            lerp: 0.03, // 스크롤 감도
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // GSAP ScrollTrigger와 Lenis 연동
        gsap.ticker.add(ScrollTrigger.update);
        ScrollTrigger.defaults({ scroller: window });

        // body에 'gnb_on' 또는 'cover' 클래스가 있으면 스크롤 정지, 없으면 다시 시작
        const toggleLenisScroll = () => {
            if ($('body').hasClass('gnb_on') || $('body').hasClass('cover')) {
                lenis.stop();
            } else {
                lenis.start();
            }
        };

        // MutationObserver로 body 클래스 변경 감지
        const observer = new MutationObserver(toggleLenisScroll);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        // 초기 상태 확인
        toggleLenisScroll();
    });
    // 레니스 스크롤

    // 프로젝트 섹션 gsap
    $(function () {
        const items = document.querySelectorAll("#project_sec .itm");

        // 모든 itm 초기값 height: 100%
        gsap.set(items, { height: '100%' });

        items.forEach((item, index) => {
            // 마지막 항목은 애니메이션 제외
            if (index === items.length - 1) return;

            const nextItem = items[index + 1];

            const triggerStart = index * window.innerHeight;
            const triggerEnd = (index + 1) * window.innerHeight;

            gsap.to(item, {
                height: '0%',
                scrollTrigger: {
                    trigger: '#project_sec',
                    start: () => `${triggerStart} top`,
                    end: () => `${triggerEnd} top`,
                    scrub: true,
                    invalidateOnRefresh: true,
                }
            });
        });

        // 프로젝트 섹션 헤더 온
        ScrollTrigger.create({
            trigger: '#project_sec',
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: self => {
                const scroll = self.scroll(); // 현재 scrollTop
                const winH = window.innerHeight;

                const pfIndexStart = Array.from(items).findIndex(item => item.id === 'pf01');
                const pfIndexEnd = Array.from(items).findIndex(item => item.id === 'pf03');

                // 중간 지점 계산
                const sectionHeight = winH;
                const pfStart = pfIndexStart * sectionHeight;
                const pfEnd = (pfIndexEnd + 1) * sectionHeight;

                const header = document.querySelector('#header');

                if (scroll + winH / 2 >= pfStart && scroll + winH / 2 < pfEnd) {
                    header.classList.add('on');
                } else {
                    header.classList.remove('on');
                }
            },
            invalidateOnRefresh: true
        });


        // 스크롤 위치 강제 초기화 + 트리거 강제 새로고침
        window.addEventListener("load", () => {
            window.scrollTo(0, 0); // ✅ 진입 시 위치 초기화
            ScrollTrigger.refresh();
        });
    });


    // 네비게이션 //
    $(function () {
        const itemHeight = window.innerHeight;
        const baseOffset = document.querySelector('#project_sec').offsetTop;

        const targets = ['intro', 'pf01', 'pf02', 'pf03', 'work_list', 'profile'];

        targets.forEach((target, index) => {
            const el = document.querySelector(`[data-target="${target}"]`);
            if (el) {
                el.addEventListener('click', e => {
                    e.preventDefault();

                    const scrollToY = baseOffset + index * itemHeight;

                    gsap.to(window, {
                        scrollTo: scrollToY,
                        duration: 1,
                        ease: "power2.inOut"
                    });

                    history.replaceState(null, '', ' ');

                });
            }
        });
    });


    // 모바일 메뉴 버튼
    $(function () {

        $('#header .m_menu_btn').on('click', function () {
            $('#header #gnb').toggleClass('on');
            $('body').toggleClass('gnb_on');
            $(this).toggleClass('on');
        });
        $('#header #gnb>ul>li>a').on('click', function () {
            $('body').removeClass('gnb_on');
            $('#header #gnb').removeClass('on');
        });

    });



});


