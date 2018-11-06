let id_ = 'ctl00_ContentPlaceHolder1_Stu_TeamDetailControl1_rpTeams_ctl18_lbTeamName';

function gogo() {
    fetch('https://gamerslouis.github.io/nctue3.html').then((res) => {
        return res.text();
    }).then((content) => {
        document.getElementById(id_).innerHTML = content;
        loadCSSFile("https://cdnjs.cloudflare.com/ajax/libs/csshake/1.5.3/csshake.min.css");
        document.getElementById('shakebutton').addEventListener('click', shaketogether);
    });
}

$(document).ready(gogo);

var shaked = false;
function shaketogether() {
    if (shaked) return;
    addShakeTo();
    div = document.getElementById('shakebutton');
    div.value = '以搖晃你的組別';
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

function loadCSSFile(URL) {
    try {
        let css = document.createElement('link');
        css.setAttribute('rel', 'stylesheet');
        css.setAttribute('type', 'text/css');
        css.setAttribute('href', URL);
        document.getElementsByTagName('head')[0].appendChild(css);
    }
    catch (e) {
        return false;
    }
    return true;
}
