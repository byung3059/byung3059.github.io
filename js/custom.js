MainFullpage();
menuBtnAction();




function MainFullpage() {
    let tt = false;
    const nav = document.querySelectorAll('.gnb li');

    const tl = gsap.timeline({ pause: true, });

    let t = 1;


    tl
        .to('.start_cover .line', {
            right: 0,
            duration: 2,
        })
        .to('.start_cover .line', {
            opacity: 0,
        })
        .to('.start_cover .back01', {

            top: "-50%",
            duration: 2,
        })
        .to('.start_cover .back02 ', {

            bottom: "-50%",
            duration: 2,
        }, "-=2")
        .to('.start_cover', {
            display: 'none'
        }, "-=0.3")

    const portFolio = new fullpage('.content', {
        anchors: ['INTRO', 'PROJECT01', 'PROJECT02', 'PROJECT03', 'PROJECT04', 'TRANNING', 'PROFILE'],
        scrollingSpeed: 500,

        scrollOverflowOptions: {
            click: true
        },


        onLeave: function (origin, destination, direction) {
            let idx = destination.index;
            nav.forEach(it => it.classList.remove('on'))
            nav[idx].classList.add('on');

            console.log(idx)

            const hd = document.querySelector('.hd')
            const menubtn = document.querySelector('.menu')

            if (idx === 0) {
                hd.classList.add('on');
                menubtn.classList.add('active')

            } else {
                hd.classList.remove('on');
                menubtn.classList.remove('active')
            }
        }

    });

}

function menuBtnAction() {
    const btn = document.querySelector('.menu .btn');
    const cover = document.querySelector('.cover');
    const lnk = document.querySelectorAll('.lnb a');

    function coverAnimation() {
        cover.classList.toggle('on');
        btn.parentElement.classList.toggle('on');
    }

    function linkMove() {
        cover.classList.remove('on');
        btn.parentElement.classList.remove('on');
    }

    btn.addEventListener('click', coverAnimation);

    lnk.forEach(el => {
        el.addEventListener('click', linkMove)
    });

    cover.addEventListener('wheel', function (e) {
        e.stopPropagation();
    })

}

