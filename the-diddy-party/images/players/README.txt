PLAYER CARD IMAGES
Each player card loads: images/players/player-<id>.svg  (id = the player's id: 1 = Geraldo, 2 = Luca, ...)
To swap in a real photo, either:
  1. Drop a file in this folder and set  image: "images/players/geraldo.jpg"  on that player in js/app.js, or
  2. Edit the placeholder path in js/app.js (defaultData.players -> image).
Best size: square, ~400x400px (JPG/PNG/WebP/SVG). Missing images fall back to default.svg.
