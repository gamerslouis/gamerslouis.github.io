let id_ = 'ctl00_ContentPlaceHolder1_Stu_TeamDetailControl1_rpTeams_ctl18_lbTeamName';

function gogo() {
    fetch('https://gamerslouis.github.io/nctue3.html').then((res) => {
        return res.text();
    }).then((content) => {
        document.getElementById(id_).innerHTML = content;
    });
}

$(document).ready(gogo);