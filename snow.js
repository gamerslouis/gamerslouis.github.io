//Constants -- Dont touch here
const speedFactor = 0.1;

//User Variables
var xMaxSpeed = 15;
var yMaxSpeed = 70;
var yMinSpeed = 7;
var snowcount = 100;
var snowcountMax = 400;
var sizeMax = 100;
//var timeGap = 10;

//Runtime Variables
var xMax;
var yMax;
var snowContainer;
var snowing = false;
var snows = [];

$(document).ready(function () {
    xMax = document.body.clientWidth;
    yMax = document.body.clientHeight;
    initSnow();
});

$(window).resize(function () {
    xMax = document.body.clientWidth;
    yMax = document.body.clientHeight;
});

function initSnow() {
    loadCSSFile('https://gamerslouis.github.io/snow.css');

    snowContainer = document.createElement('div');
    snowContainer.classList.add('snowcontainer');
    document.body.appendChild(snowContainer);

    for (let i = 0; i < snowcountMax; i++) {
        let div = document.createElement('div');
        div.classList.add('snoww');
        div.style.display = 'none';

        div.innerText = '*'
        div.style.fontSize = sizeMax * Math.random() + 'px';


        div.py = -400 * Math.random() - 150;
        div.px = xMax * Math.random();
        drawSnow(div);

        div.xSpeed = xMaxSpeed * Math.random();
        div.ySpeed = (yMaxSpeed - yMinSpeed) * Math.random() + yMinSpeed;

        snows[i] = div;
        snowContainer.appendChild(div);
    }
}



function resetPosition(snow) {
    snow.py = -150;
    snow.px = xMax * Math.random();
}

function drawSnow(snow) {
    snow.style.top = snow.py + 'px';
    snow.style.left = snow.px + 'px';
}

function updateSnow() {
    if (!snowing) return;
    for (let i = 0; i < snowcount; i++) {
        snows[i].py += snows[i].ySpeed * speedFactor;
        snows[i].px += snows[i].xSpeed * speedFactor;
        if (snows[i].py > yMax || snows[i].px > xMax) {
            resetPosition(snows[i]);
        }
        drawSnow(snows[i]);
    }
    requestAnimationFrame(updateSnow);
}

function startSnow() {
    snowing = true;
    for (let i = 0; i < snowcount; i++) {
        snows[i].style.display = 'inline';
    }
    updateSnow();
}

function endSnow() {
    snowing = false;
    for (let i = 0; i < snowcount; i++) {
        snows[i].style.display = 'none';
    }
}

function setSnowCount(newSnowcount){
	let oldSnowcount = snowcount;
	snowcount = newSnowcount > snowcountMax ? snowcountMax : newSnowcount;
	if (newSnowcount < oldSnowcount)
		for (let i = newSnowcount ; i<oldSnowcount ; i++){
			resetPosition(snows[i]);
			drawSnow(snows[i]);
		}
}
