var gmls_shaked = false;
function shaketogether() {
    if (gmls_shaked) return;
    addShakeTo();
    div = document.getElementById('shakebutton');
    div.value = '現在看看你的組別';
    gmls_shaked = true;
}

function addShakeTo() {
    let student = getStudentName();

    student.classList.add("shake");
    student.classList.add("shake-slow");
    student.classList.add("shake-constant");

    student.addEventListener('mouseover', onmouseover);
    student.addEventListener('mouseout', onmouseout);

}

function getStudentName() {
    let name = document.getElementById('ctl00_lbAccount').innerText;
    let targetname = null;
    for (let e of document.getElementsByClassName('TblOddRow')) {
        if (e.childNodes[2].innerText == name)
            targetname = e.parentElement.parentElement.parentElement.parentElement.previousElementSibling.childNodes[3].childNodes[1];
    }

    if (targetname == null) {
        for (let e of document.getElementsByClassName('TblEvenRow')) {
            if (e.childNodes[2].innerText == name)
                targetname = e.parentElement.parentElement.parentElement.parentElement.previousElementSibling.childNodes[3].childNodes[1];
        }
    }
    return targetname;
}

function onmouseover() {
    this.classList.remove("shake");
    this.classList.remove("shake-slow");
    this.classList.remove("shake-constant");
}

function onmouseout() {
    this.classList.add("shake");
    this.classList.add("shake-slow");
    this.classList.add("shake-constant");
}

function startQuake()
{
    $('*').removeClass('shake');
    $('*').removeClass('shake-constant');
    $('*').removeClass('shake-slow');
    let level = document.getElementById('quakeLevel').value;
    switch (level) {
        case 1:
            $('span').addClass('shake');
            $('span').addClass('shake-constant');
            $('span').addClass('shake-slow');
            break;
        case 2:
            $('body').addClass('shake');
            $('body').addClass('shake-constant');
            $('body').addClass('shake-slow');
            break;
        case 3:
            $('td').addClass('shake');
            $('td').addClass('shake-constant');
            $('td').addClass('shake-slow');
            break;
        case 4:
            $('*').addClass('shake');
            $('*').addClass('shake-constant');
            $('*').addClass('shake-slow');
            break;
    }
}

document.addEventListener('keydown', (e) => {
    if (e.keyCode == 32) {
        $('*').removeClass('shake');
        $('*').removeClass('shake-constant');
        $('*').removeClass('shake-slow');
    }
})