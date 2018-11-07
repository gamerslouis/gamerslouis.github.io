var shaked = false;
function shaketogether() {
    if (shaked) return;
    addShakeTo();
    div = document.getElementById('shakebutton');
    div.value = '現在看看你的組別';
    shaked = true;
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