function Block(x, y){
	this.x = x;
	this.y = y;
	this.occupier = -1;
	this.tmpAccess = false;
	
	this.show = function (){
		push();
		translate(center);
		noStroke();
		switch(this.occupier){
		case 0:
			fill(block_red);
			break;
		case 1:
			fill(block_blue);
			break;
		default :
			fill(white);
		}
		rectMode(CENTER);
		rect(this.x, this.y, blockSize, blockSize);
		if (this.occupier == 0){
			image(img_x, this.x - blockSize / 2, this.y - blockSize / 2, blockSize, blockSize);
		}
		else if (this.occupier == 1){
			image(img_o, this.x - blockSize / 2, this.y - blockSize / 2, blockSize, blockSize);
		}
		pop();
	}
	
	this.showException = function (accessible){
		this.tmpAccess = accessible;
		push();
		translate(center);
		noStroke();
		fill(accessible ? except_yellow : except_gray);
		rectMode(CENTER);
		rect(this.x, this.y, blockSize, blockSize);
		pop();
	}
	
	this.onClick = function (x, y){
		if (abs(this.x - x) < blockSize / 2 && abs(this.y - y) < blockSize / 2){
			if (this.occupier == -1){
				this.occupier = player;
				return true;	
			}
			if (this.tmpAccess){
				this.tmpAccess = false;
				return true;
			}
		}
		return false;
	}
}