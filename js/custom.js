MainFullpage();
menuBtnAction();
// clock();



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
        anchors: ['INTRO', 'PROJECT01', 'PROJECT02', 'PROJECT03', 'TRANNING', 'PROFILE'],
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


// function clock() {
//     setInterval(() => {
//         // 현재 날짜 time에 할당
//         const time = new Date()

//         // time에서 시간만 추출 (시, 분, 초)
//         const hour = time.getHours();     //0~23
//         const min = time.getMinutes();      //0~59
//         const sec = time.getSeconds();      //0~59

//         // 화면상의 객체 선택
//         const hh = document.getElementById('hour')
//         const mm = document.getElementById('min')
//         const ss = document.getElementById('sec')

//         // 각도 선택
//         if (hour >= 12) {
//             const DegHour = (hour - 12) * 30 + min * (360 / 12 / 60) // 분을 고려해서 시침이 한번에 움직이지 않게 하기 위함 
//             const DegMin = min * 6
//             const DegSec = sec * 6

//             hh.style.transform = `rotate(${DegHour}deg)`;
//             mm.style.transform = `rotate(${DegMin}deg)`;
//             ss.style.transform = `rotate(${DegSec}deg)`;

//         }
//         else {
//             const DegHour = (hour - 12) * 30 + min * (360 / 12 / 60)    // 0.5를 곱해 60분기준 30도를 추가 ex) 30분이라면 15도의 각도 추가
//             const DegMin = min * 6
//             const DegSec = sec * 6

//             hh.style.transform = `rotate(${DegHour}deg)`;
//             mm.style.transform = `rotate(${DegMin}deg)`;
//             ss.style.transform = `rotate(${DegSec}deg)`;
//         }
//     }, 1000)
// }












