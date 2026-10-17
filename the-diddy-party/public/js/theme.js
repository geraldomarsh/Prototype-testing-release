/* Theme switcher: swaps the #themeLink stylesheet and remembers the choice.
   To add a theme: add a css file in /css, then add an <option> to #themeSelect. */
(function () {
  var KEY = "diddyTheme";
  var link = document.getElementById("themeLink");
  var saved = "";
  try { saved = localStorage.getItem(KEY) || ""; } catch (e) {}
  if (link) link.href = saved;           // apply immediately (avoids a flash)

  document.addEventListener("DOMContentLoaded", function () {
    var select = document.getElementById("themeSelect");
    if (!select) return;
    select.value = saved;
    if (select.value !== saved) select.value = "";   // saved theme no longer exists
    select.addEventListener("change", function () {
      if (link) link.href = select.value;
      try { localStorage.setItem(KEY, select.value); } catch (e) {}
    });
  });
})();
