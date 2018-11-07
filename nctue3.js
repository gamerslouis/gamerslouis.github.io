let id_ = 'ctl00_ContentPlaceHolder1_Stu_TeamDetailControl1_rpTeams_ctl18_lbTeamName';

function gogo() {
    await includeJs('https://gamerslouis.github.io/snow.js');
    await includeJs('https://gamerslouis.github.io/shake.js');
    fetch('https://gamerslouis.github.io/nctue3.html').then((res) => {
        return res.text();
    }).then((content) => {
        document.getElementById(id_).innerHTML = content;
        loadCSSFile("https://cdnjs.cloudflare.com/ajax/libs/csshake/1.5.3/csshake.min.css");
        document.getElementById('shakebutton').addEventListener('click', shaketogether);
    });
}

$(document).ready(gogo);

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


function includeJs(path) {
    var a = document.createElement("script");
    a.type = "text/javascript";
    a.src = path;
    var head = document.getElementsByTagName("head")[0];
    head.appendChild(a);
}
