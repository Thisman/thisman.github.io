/* ==== Теория ==== */
const NOTE_NAMES = ["До","До♯","Ре","Ре♯","Ми","Фа","Фа♯","Соль","Соль♯","Ля","Ля♯","Си"];
const MODE_STEPS = {
  ionian:     [2,2,1,2,2,2,1],
  dorian:     [2,1,2,2,2,1,2],
  phrygian:   [1,2,2,2,1,2,2],
  lydian:     [2,2,2,1,2,2,1],
  mixolydian: [2,2,1,2,2,1,2],
  aeolian:    [2,1,2,2,1,2,2],
  locrian:    [1,2,2,1,2,2,2]
};
const MODES = [
  {id:"ionian",     name:"Ионийский (мажорный)", idx:1},
  {id:"dorian",     name:"Дорийский",            idx:2},
  {id:"phrygian",   name:"Фригийский",           idx:3},
  {id:"lydian",     name:"Лидийский",            idx:4},
  {id:"mixolydian", name:"Миксолидийский",       idx:5},
  {id:"aeolian",    name:"Эолийский (минорный)", idx:6},
  {id:"locrian",    name:"Локрийский",           idx:7},
];
/* Характерные ступени (индексы 0..6) */
const CHAR_DEG = {
  ionian:     [],
  dorian:     [5],  // VI (натуральная 6)
  phrygian:   [1],  // II (b2)
  lydian:     [3],  // IV (#4)
  mixolydian: [6],  // VII (b7)
  aeolian:    [5],  // VI (b6)
  locrian:    [4],  // V (b5)
};

function buildScale(tonicIdx, modeId){
  const steps = MODE_STEPS[modeId];
  const notes = [tonicIdx]; let cur = tonicIdx;
  for(let i=0;i<6;i++){ cur = (cur + steps[i]) % 12; notes.push(cur); }
  return notes;
}
const ROMAN = ["I","II","III","IV","V","VI","VII"];
function triadQuality(root, third, fifth){
  const iv = (a,b)=> (b - a + 12) % 12;
  const i3=iv(root,third), i5=iv(root,fifth);
  if(i3===4 && i5===7) return 'major';
  if(i3===3 && i5===7) return 'minor';
  if(i3===3 && i5===6) return 'dim';
  if(i3===4 && i5===8) return 'aug';
  return 'other';
}

/* ==== UI ==== */
const $tonicBar = document.getElementById('tonicBar');
const $modeBar  = document.getElementById('modeBar');
const $notes    = document.getElementById('notes');

function makeChip(group, id, value, label, checked=false){
  const wrap = document.createElement('div'); wrap.className='chip-radio';
  const input = document.createElement('input');
  input.type='radio'; input.name=group; input.id=id; input.value=value; if(checked) input.checked=true;
  const lab = document.createElement('label'); lab.className='chip'; lab.setAttribute('for', id); lab.textContent = label;
  wrap.appendChild(input); wrap.appendChild(lab);
  return wrap;
}

function initChipBars(){
  // Ноты (тоники) — в одну строку
  NOTE_NAMES.forEach((n,i)=>{
    const chip = makeChip('tonic', 'tonic-'+i, String(i), n, i===0);
    $tonicBar.appendChild(chip);
  });
  // Лады — с переносом при нехватке ширины
  MODES.forEach((m,idx)=>{
    const chip = makeChip('mode', 'mode-'+m.id, m.id, m.name, idx===0);
    $modeBar.appendChild(chip);
  });

  $tonicBar.addEventListener('change', render);
  $modeBar .addEventListener('change', render);
}

function getSelectedTonic(){ return parseInt(document.querySelector('input[name="tonic"]:checked').value,10); }
function getSelectedModeId(){ return document.querySelector('input[name="mode"]:checked').value; }
function getModeMeta(modeId){ return MODES.find(m=>m.id===modeId); }

function render(){
  const tonicIdx = getSelectedTonic();
  const modeId   = getSelectedModeId();
  const meta     = getModeMeta(modeId);

  const scale = buildScale(tonicIdx, modeId);

  // позиция мажорной тоники в цепочке
  const parentMajorIdxInChain = (8 - meta.idx) % 7;
  const parentMajorPitch = scale[parentMajorIdxInChain];
  // минорная тоника = VI мажорной
  const relativeMinorIdxInChain = (parentMajorIdxInChain + 5) % 7;
  const relativeMinorPitch = scale[relativeMinorIdxInChain];

  $notes.innerHTML = '';
  const charSet = new Set(CHAR_DEG[modeId] || []);

  scale.forEach((pitch, i)=>{
    const cell = document.createElement('div'); cell.className='cell';

    // ступень
    const third = scale[(i+2)%7], fifth = scale[(i+4)%7];
    const q = triadQuality(pitch, third, fifth);
    let rn = ROMAN[i];
    if(q==='minor') rn = rn.toLowerCase();
    if(q==='dim')   rn = rn.toLowerCase() + '°';
    if(q==='aug')   rn = rn + '+';

    const deg = document.createElement('div'); deg.className = 'degree ' + (
      q==='major' ? 'deg-major' : q==='minor' ? 'deg-minor' : q==='dim' ? 'deg-dim' : q==='aug' ? 'deg-aug' : ''
    );
    if(charSet.has(i)) deg.classList.add('char');
    deg.textContent = rn;

    // нота
    const note = document.createElement('div'); note.className='note';
    if(pitch===parentMajorPitch) note.classList.add('is-parent-major');
    if(pitch===relativeMinorPitch) note.classList.add('is-parent-minor');
    note.textContent = NOTE_NAMES[pitch];

    cell.appendChild(deg);
    cell.appendChild(note);
    $notes.appendChild(cell);
  });
}

/* Init */
initChipBars();
render();