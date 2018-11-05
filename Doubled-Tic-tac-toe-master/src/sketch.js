const tintLevel = 191;
//color constants
const bg_gray = '#ADADAD';
const bg_blue = '#2860ff';
const bg_red = '#ff2828';
const white = '#FFFFFF'
const text_blue = '#6d93ff';
const text_red = '#ff6d6d';
const highlight_yellow = '#fffc4c';
const grid_black = '#000000';
const grid_blue = '#0042ff';
const grid_red = '#ff0000';
const block_blue = '#6d93ff';
const block_red = '#ff6d6d';
const except_yellow = '#fffda0';
const except_gray = '#999999';

//images
var img_o;
var img_x;
//canvas
var canvas;
var canvasW;
var canvasH;
var horizontal_mode;
//grid, block, gap, text
var gridSize;
var gapSize;
var blockSize;
var blockgapSize;
var gridPos = [];
var blockPos = [];
var textsize;
var space;
//game
var blocks = [];
var center;
var occupied = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
var winner;
var player = 1;
var next = -1;


function setup(){
	setCanvasSize(windowWidth - 15, windowHeight - 15);
	canvas = createCanvas(canvasW, canvasH);
	center = createVector(canvasW / 2, canvasH / 2);
	horizontal_mode = (min(canvasW, canvasH) == canvasH);
	setRelativeSize(horizontal_mode ? canvasH - 114 : canvasW);
	setupRelativePosition();
	setupGrids();
	setTextSize();
	translate(center);
	
	winner = -1;
}

function preload(){
	img_o = loadImage("https://raw.githubusercontent.com/hm-ysjiang/Doubled-Tic-tac-toe/master/assets/O_general.png");
	img_x = loadImage("https://raw.githubusercontent.com/hm-ysjiang/Doubled-Tic-tac-toe/master/assets/X_general.png");
}

function draw(){
	drawBackground();
	drawGridsBackground();
	drawBlocks();
	drawExceptions();
	drawGridsForeground();
	drawHighlight();
	drawText();
}

function mousePressed(){
	if (winner == -1){
		if (next == -1){
			for (let i = 0 ; i<9 ; i++){
				for (let j = 0 ; j<9 ; j++){
					if (blocks[i][j].onClick(mouseX - center.x, mouseY - center.y)){
						next = j;
						player++;
						player %= 2;
						break;
					}
				}
			}
		}
		else {
			for (let j = 0 ; j<9 ; j++){
				if (blocks[next][j].onClick(mouseX - center.x, mouseY - center.y)){
					if (occupied[next] == -1){
						if (check(next)){
							occupied[next] = player;
							if (checkAll()){
								winner = player;
							}
						}
					}
					next = j;
					player++;
					player %= 2;
					break;
				}	
			}
		}
	}
}

function setCanvasSize(winWidth, winHeight){
	if (winWidth > winHeight){
		canvasW = winWidth;
		canvasH = 19 * floor(winHeight / 19);
	}
	else {
		canvasH = winHeight;
		canvasW = 19 * floor(winWidth / 19);
	}
}

function setRelativeSize(length){
	gapSize = length / 19;
	gapSize -= gapSize % 10;
	gridSize = gapSize * 5;
	blockgapSize = gridSize / 50
	blockSize = blockgapSize * 16;
}

function setupRelativePosition(){
	//grids
	gridPos.push([-(gridSize + gapSize), -(gridSize + gapSize)]);
	gridPos.push([0, -(gridSize + gapSize)]);
	gridPos.push([(gridSize + gapSize), -(gridSize + gapSize)]);
	gridPos.push([-(gridSize + gapSize), 0]);
	gridPos.push([0, 0]);
	gridPos.push([(gridSize + gapSize), 0]);
	gridPos.push([-(gridSize + gapSize), (gridSize + gapSize)]);
	gridPos.push([0, (gridSize + gapSize)]);
	gridPos.push([(gridSize + gapSize), (gridSize + gapSize)]);
	//blocks
	blockPos.push([-(blockSize + blockgapSize), -(blockSize + blockgapSize)]);
	blockPos.push([0, -(blockSize + blockgapSize)]);
	blockPos.push([(blockSize + blockgapSize), -(blockSize + blockgapSize)]);
	blockPos.push([-(blockSize + blockgapSize), 0]);
	blockPos.push([0, 0]);
	blockPos.push([(blockSize + blockgapSize), 0]);
	blockPos.push([-(blockSize + blockgapSize), (blockSize + blockgapSize)]);
	blockPos.push([0, (blockSize + blockgapSize)]);
	blockPos.push([(blockSize + blockgapSize), (blockSize + blockgapSize)]);
}

function setupGrids(){
	for (let i = 0 ; i<9 ; i++){
		setupBlocksInGrid(gridPos[i][0], gridPos[i][1]);
	}
}

function setupBlocksInGrid(x, y){
	let tmp = []
	for (let i = 0 ; i<9 ; i++){
		tmp.push(new Block(x + blockPos[i][0], y + blockPos[i][1]));
	}
	blocks.push(tmp);
}

function setTextSize(){
	space = (height - gridSize * 3 - gapSize * 4) / 2;
	if (horizontal_mode){
		textsize = space / 2;
	}
	else{
		textsize = width/12;
	}
}

function drawBackground(){
	switch(winner){
	case 0:
		background(bg_red);
		break;
	case 1:
		background(bg_blue);
		break;
	default :
		background(bg_gray);
	}
}

function drawBlocks(){
	for (let i = 0 ; i<9 ; i++){
		for (let j = 0 ; j<9 ; j++){
			blocks[i][j].show();
		}	
	}
}

function drawGridsBackground(){
	for (let i = 0 ; i<9 ; i++){
		push();
		translate(center);
		noStroke();
		rectMode(CENTER);
		switch(occupied[i]){
		case 0:
			fill(grid_red);
			break;
		case 1:
			fill(grid_blue);
			break;
		default:
			fill(grid_black);
		}
		rect(gridPos[i][0], gridPos[i][1], gridSize, gridSize);
		pop();
	}
}

function drawGridsForeground(){
	for (let i = 0 ; i<9 ; i++){
		if (occupied[i] == 0){
			push();
			translate(center);
			tint(255, tintLevel);
			image(img_x, gridPos[i][0] - gridSize / 2, gridPos[i][1] - gridSize / 2, gridSize, gridSize);
			pop();
		}
		else if (occupied[i] == 1){
			push();
			translate(center);
			tint(255, tintLevel);
			image(img_o, gridPos[i][0] - gridSize / 2, gridPos[i][1] - gridSize / 2, gridSize, gridSize);
			pop();
		}
	}
}

function drawHighlight(){
	if (next != -1){
		push();
		translate(center);
		stroke(highlight_yellow);
		strokeWeight(gapSize / 3);
		noFill();
		rectMode(CENTER);
		rect(gridPos[next][0], gridPos[next][1], gridSize + gapSize, gridSize + gapSize);
		pop();
	}
}

function drawText(){
	push();
	translate(center);
	noStroke();
	textSize(textsize);
	textAlign(CENTER);
	if (winner == -1){
		if (player == 0){
			fill(text_red);
		}
		else if (player == 1){
			fill(text_blue);
		}
		textAlign(CENTER, TOP);
		text("Player " + (2-player) + "'s turn", 0, -(height / 2 - textsize / 2));
		textAlign(CENTER, BOTTOM);
		text("Player " + (2-player) + "'s turn", 0, (height / 2 - textsize / 2));		
	}
	else {
		fill(white);
		textAlign(CENTER, TOP);
		text("Player " + (2-winner) + " won the game", 0, -(height / 2 - textsize / 2));
		textAlign(CENTER, BOTTOM);
		text("Player " + (2-winner) + " won the game", 0, (height / 2 - textsize / 2));	
	}
	pop();
}

function drawExceptions(){
	if (next != -1 && fullyOccupied(next)){
		for (let i = 0 ; i<9 ; i++){
			blocks[next][i].showException(next != i && !fullyOccupied(i));
		}
	}
}

function check(idx){
	let tmp = blocks[idx];
	for (let i = 0 ; i<9 ; i+=3){
		if (tmp[i].occupier == -1 || tmp[i+1].occupier == -1 || tmp[i+2].occupier == -1){
			continue;
		}
		if (tmp[i].occupier == tmp[i+1].occupier && tmp[i+1].occupier == tmp[i+2].occupier){
			occupied[idx] = player;
			return true;
		}
	}
	for (let i = 0 ; i<3 ; i++){
		if (tmp[i].occupier == -1 || tmp[i+3].occupier == -1 || tmp[i+6].occupier == -1){
			continue;
		}
		if (tmp[i].occupier == tmp[i+3].occupier && tmp[i+3].occupier == tmp[i+6].occupier){
			occupied[idx] = player;
			return true;
		}
	}
	if (tmp[0].occupier != -1 && tmp[4].occupier != -1 && tmp[8].occupier != -1 && tmp[0].occupier == tmp[4].occupier && tmp[4].occupier == tmp[8].occupier){
		occupied[idx] = player;
		return true;
	}
	if (tmp[2].occupier != -1 && tmp[4].occupier != -1 && tmp[6].occupier != -1 && tmp[2].occupier == tmp[4].occupier && tmp[4].occupier == tmp[6].occupier){
		occupied[idx] = player;
		return true;
	}
	return false;
}

function checkAll(){
	for (let i = 0 ; i<9 ; i+=3){
		if (occupied[i] == -1 || occupied[i+1] == -1 || occupied[i+2] == -1){
			continue;
		}
		if (occupied[i] == occupied[i+1] && occupied[i+1] == occupied[i+2]){
			return true;
		}
	}
	for (let i = 0 ; i<3 ; i++){
		if (occupied[i] == -1 || occupied[i+3] == -1 || occupied[i+6] == -1){
			continue;
		}
		if (occupied[i] == occupied[i+3] && occupied[i+3] == occupied[i+6]){
			return true;
		}
	}
	if (occupied[0] != -1 && occupied[4] != -1 && occupied[8] != -1 && occupied[0] == occupied[4] && occupied[4] == occupied[8]){
		return true;
	}
	if (occupied[2] != -1 && occupied[4] != -1 && occupied[6] != -1 && occupied[2] == occupied[4] && occupied[4] == occupied[6]){
		return true;
	}
	return false;
}

function fullyOccupied(idx){
	for (let i = 0 ; i<9 ; i++){
		if (blocks[idx][i].occupier == -1){
			return false;
		}
	}
	return true;
}
