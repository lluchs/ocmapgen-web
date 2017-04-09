(function() {
  'use strict'

  let keyboard = document.getElementById('keyboard')
  let themes = document.getElementById('themes')
  let configureEditorButton = document.getElementById('configure-editor')

  let editor = ace.edit('editor')
  editor.$blockScrolling = Infinity;
  editor.setAnimatedScroll(true);
  let session = editor.getSession();
  let themelist = ace.require("ace/ext/themelist");

  editor.focus()

  buildThemes(themelist)
  let theme = optionalLocalStorageGetItem("theme");
  if (theme === null) {
    setTheme("GitHub");
  } else {
    setTheme(theme);
  }

  let mode = optionalLocalStorageGetItem("keyboard");
  if (mode !== null) {
    setKeyboard(mode);
    keyboard.value = mode;
  }

  let query = getQueryParameters();
  if ("code" in query) {
    session.setValue(query.code);
  }  else {
    var code = optionalLocalStorageGetItem("code");
    if (code !== null) {
      session.setValue(code);
    }
  }
  if ("maptype" in query) {
    var radio = document.getElementById(`maptype-${query.maptype}`)
    if (radio)
      radio.checked = true
  }

  addEventListener("resize", function() {
    editor.resize();
  });

  //This helps re-focus editor after a Run or any other action that caused
  //editor to lose focus. Just press Enter or Esc key to focus editor.
  //Without this, you'd most likely have to LMB somewhere in the editor
  //area which would change the location of its cursor to where you clicked.
  addEventListener("keyup", function(e) {
    if ((document.body == document.activeElement) && //needed to avoid when editor has focus already
      (13 == e.keyCode || 27 == e.keyCode)) { //Enter or Escape keys
      editor.focus();
    }
  });

  session.on("change", function() {
    var code = session.getValue();
    optionalLocalStorageSetItem("code", code);
  });

  document.getElementById('share').onclick = function() {
    share(getRadioValue('maptype'), session.getValue(), this)
  }

  keyboard.onkeyup = keyboard.onchange = function() {
    var mode = keyboard.options[keyboard.selectedIndex].value;
    optionalLocalStorageSetItem("keyboard", mode);
    setKeyboard(mode);
  };
  themes.onkeyup = themes.onchange = function () {
    setTheme(themes.options[themes.selectedIndex].text);
  };

  configureEditorButton.onclick = function() {
    var dropdown = configureEditorButton.nextElementSibling;
    dropdown.style.display = dropdown.style.display ? "" : "block";
  };

  document.getElementById('evaluate').onclick =  () => {
    evaluate()
    editor.focus()
  }

  editor.commands.addCommand({
    name: "evaluate",
    exec: evaluate,
    bindKey: {win: "Ctrl-Enter", mac: "Ctrl-Enter"}
  });

  function evaluate() {
    let source = session.getValue()
    let maptype = getRadioValue('maptype')
    fetch(`/api/${maptype}`, {
      method: 'POST',
      body: source,
    })
      .then(response => {
        if (response.ok)
          return response.blob()
        else
          return response.text().then(t => Promise.reject(t))
      })
      .then(image => {
        let img = new Image()
        img.src = URL.createObjectURL(image)
        setResult(img)
      })
      .catch(error => {
        let pre = document.createElement('pre')
        pre.textContent = error
        setResult(pre)
      })
  }

  /* Function stolen from rust-playpen */

  function getRadioValue(name) {
    var nodes = document.getElementsByName(name);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.checked) {
        return node.value;
      }
    }
  }

  let result = document.getElementById('result')
  function setResult(contents) {
    if (contents === undefined) {
      result.textContent = "";
    } else if (typeof contents == "string") {
      result.innerHTML = contents;
    } else {
      result.textContent = "";
      result.appendChild(contents);
    }
  }

  function setKeyboard(mode) {
    if (mode == "Emacs") {
      editor.setKeyboardHandler("ace/keyboard/emacs");
    } else if (mode == "Vim") {
      editor.setKeyboardHandler("ace/keyboard/vim");
      if (!setKeyboard.vim_set_up) {
        ace.config.loadModule("ace/keyboard/vim", function(m) {
          var Vim = ace.require("ace/keyboard/vim").CodeMirror.Vim;
          Vim.defineEx("write", "w", function(cm, input) {
            cm.ace.execCommand("evaluate");
          });
        });
      }
      setKeyboard.vim_set_up = true;
    } else {
      editor.setKeyboardHandler(null);
    }
  }

  function setTheme(theme) {
    var themes = document.getElementById("themes");
    var themepath = null,
      i = 0,
      themelen = themelist.themes.length,
      selected = themes.options[themes.selectedIndex];
    if (selected.textContent === theme) {
      themepath = selected.getAttribute("val");
    } else {
      for (i; i < themelen; i++) {
        if (themelist.themes[i].caption == theme) {
          themes.selectedIndex = i;
          themepath = themelist.themes[i].theme;
          break;
        }
      }
    }
    if (themepath !== null) {
      editor.setTheme(themepath);
      optionalLocalStorageSetItem("theme", theme);
    }
  }

  function buildThemes(themelist) {
    // Load all ace themes, sorted by their proper name.
    var themes = themelist.themes;
    themes.sort(function (a, b) {
      if (a.caption < b.caption) {
        return -1;
      } else if (a.caption > b.caption) {
        return 1;
      }
      return 0;
    });

    var themeopt,
      themefrag = document.createDocumentFragment();
    for (var i=0; i < themes.length; i++) {
      themeopt = document.createElement("option");
      themeopt.setAttribute("val", themes[i].theme);
      themeopt.textContent = themes[i].caption;
      themefrag.appendChild(themeopt);
    }
    document.getElementById("themes").appendChild(themefrag);
  }

  function repaintResult() {
    // Sadly the fun letter-spacing animation can leave artefacts in at
    // least Firefox, so we want to manually trigger a repaint. It doesn’t
    // matter whether it’s relative or static for now, so we’ll flip that.
    result.parentNode.style.visibility = "hidden";
    var _ = result.parentNode.offsetHeight;  // This empty assignment is intentional
    result.parentNode.style.visibility = "";
  }

  function share(maptype, code, button) {
    var playurl = location.origin+location.pathname + "?code=" + encodeURIComponent(code);
    playurl += "&maptype=" + encodeURIComponent(maptype);
    if (playurl.length > 5000) {
      setResult("<p class=error>Sorry, your code is too long to share this way." +
        "<p class=error-explanation>At present, sharing produces a link containing the" +
        " code in the URL, and the URL shortener used doesn’t accept URLs longer than" +
        " <strong>5000</strong> characters. Your code results in a link that is <strong>" +
        playurl.length + "</strong> characters long. Try shortening your code.");
      return;
    }

    var url = "https://is.gd/create.php?format=json&url=" + encodeURIComponent(playurl);

    button.disabled = true;

    setResult("<p>Short URL: ");
    var link = document.createElement("a");
    link.href = link.textContent = playurl;
    link.className = "shortening-link";
    result.firstChild.appendChild(link);


    var repainter = setInterval(repaintResult, 50);
    fetch(url)
      .then(res => res.json())
      .then(response => {
        clearInterval(repainter);
        button.disabled = false;

        var link = result.firstChild.firstElementChild;
        link.className = "";
        link.href = link.textContent = response.shorturl;

        repaintResult();
      },
      function(response) {
        clearInterval(repainter);
        button.disabled = false;

        setResult("<p class=error>Something went wrong" +
          "<p class=error-explanation>The HTTP request produced a response with status code " + response.status + ".");

        repaintResult();
      }
    );
  }

  function optionalLocalStorageGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch(e) {
      return null;
    }
  }

  function optionalLocalStorageSetItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch(e) {
      // ignore
    }
  }

  function getQueryParameters() {
    var a = window.location.search.substr(1).split('&');
    if (a === "") return {};
    var b = {};
    for (var i = 0; i < a.length; i++) {
      var p = a[i].split('=');
      if (p.length != 2) continue;
      b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
  }
}())
