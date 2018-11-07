var xMaxSpeed = 15;
var yMaxSpeed = 70;
var speedFactor = 0.1;
var timeGap = 10;
var snowcount = 500;
var sizeMax = 100;
var xMax;
var yMax;
var snowContainer;
var snowing = false;
var snows = [];

$(document).ready(function () {
    xMax = document.body.clientWidth;
    yMax = document.body.clientHeight;
    initSnow();
    startSnow();
});

$(window).resize(function () {
    xMax = document.body.clientWidth;
    yMax = document.body.clientHeight;
});

function initSnow() {
    snowContainer = document.createElement('div');
    snowContainer.classList.add('snowcontainer');
    document.body.appendChild(snowContainer);

    for (let i = 0; i < snowcount; i++) {
        let div = document.createElement('div');
        div.classList.add('snoww');
        div.style.display = 'none';

        div.innerText = '*'
        div.style.fontSize = sizeMax * Math.random() + 'px';


        div.py = -400 * Math.random();
        div.px = xMax * Math.random();
        drawSnow(div);

        div.xSpeed = xMaxSpeed * Math.random();
        div.ySpeed = yMaxSpeed * Math.random();

        snows[i] = div;
        snowContainer.appendChild(div);
    }
}



function resetPosition(snow) {
    snow.py = -20;
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
