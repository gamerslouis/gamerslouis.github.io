//Constants -- Dont touch here
const gmls_speedFactor = 0.1;

//User Variables
var gmls_xMaxSpeed = 15;
var gmls_yMaxSpeed = 70;
var gmls_yMinSpeed = 7;
var gmls_snowCount = 100;
var gmls_snowcountMax = 400;
var gmls_sizeMax = 100;
//var timeGap = 10;

//Runtime Variables
var gmls_xMax;
var gmls_yMax;
var gmls_snowContainer;
var gmls_snowing = false;
var gmls_snows = [];

$(document).ready(function () {
    gmls_xMax = document.body.clientWidth;
    gmls_yMax = document.body.clientHeight;
    initSnow();
});

$(window).resize(function () {
    gmls_xMax = document.body.clientWidth;
    gmls_yMax = document.body.clientHeight;
});

function initSnow() {
    loadCSSFile('https://gamerslouis.github.io/snow.css');

    gmls_snowContainer = document.createElement('div');
    gmls_snowContainer.classList.add('snowcontainer');
    document.body.appendChild(gmls_snowContainer);

    for (let i = 0; i < gmls_snowcountMax; i++) {
        let div = document.createElement('div');
        div.classList.add('snoww');
        div.style.display = 'none';

        div.innerText = '*'
        div.style.fontSize = gmls_sizeMax * Math.random() + 'px';


        div.py = -400 * Math.random() - 150;
        div.px = gmls_xMax * Math.random();
        drawSnow(div);

        div.xSpeed = gmls_xMaxSpeed * Math.random() - gmls_xMaxSpeed / 2;
        div.ySpeed = (gmls_yMaxSpeed - gmls_yMinSpeed) * Math.random() + gmls_yMinSpeed;

        gmls_snows[i] = div;
        gmls_snowContainer.appendChild(div);
    }
}



function resetPosition(snow) {
    snow.py = -150;
    snow.px = gmls_xMax * Math.random();
}

function drawSnow(snow) {
    snow.style.top = snow.py + 'px';
    snow.style.left = snow.px + 'px';
}

function updateSnow() {
    if (!gmls_snowing) return;
    for (let i = 0; i < gmls_snowCount; i++) {
        gmls_snows[i].py += gmls_snows[i].ySpeed * gmls_speedFactor;
        gmls_snows[i].px += gmls_snows[i].xSpeed * gmls_speedFactor;
        if (gmls_snows[i].py > gmls_yMax || gmls_snows[i].px > gmls_xMax) {
            resetPosition(gmls_snows[i]);
        }
        drawSnow(gmls_snows[i]);
    }
    requestAnimationFrame(updateSnow);
}

function startSnow() {
    gmls_snowing = true;
    for (let i = 0; i < gmls_snowCount; i++) {
        gmls_snows[i].style.display = 'inline';
    }
    updateSnow();
}

function stopSnow() {
    gmls_snowing = false;
    for (let i = 0; i < gmls_snowCount; i++) {
        gmls_snows[i].style.display = 'none';
    }
}

function setSnowCount(newSnowcount){
	let oldSnowcount = gmls_snowCount;
	gmls_snowCount = newSnowcount > gmls_snowcountMax ? gmls_snowcountMax : newSnowcount;
	if (newSnowcount < oldSnowcount)
		for (let i = newSnowcount ; i<oldSnowcount ; i++){
			resetPosition(gmls_snows[i]);
			drawSnow(gmls_snows[i]);
		}
}

function snowSwitch() {
    let butt = document.getElementById('snowbutton');
    if (gmls_snowing) {
        butt.value = '冬天來了...';
        stopSnow();
    }
    else {
        butt.value = '冬天走了...';
        startSnow();
    }
}
