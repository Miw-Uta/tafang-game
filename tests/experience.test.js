const test = require('node:test');
const assert = require('node:assert/strict');
const { TutorialProgress, steps, audioSettings, soundscape, scores, scoreKeyFor, scoreFrame } = require('../experience.js');

test('tutorial completion requires true observed facts, not clicks or loaded units', () => {
  const progress = new TutorialProgress();
  assert.equal(progress.next().key, 'scout');
  assert.equal(progress.observe({ deploy:0, merge:'true', evolve:5, wave:false }), false);
  assert.deepEqual(progress.snapshot(), []);
  assert.equal(progress.observe({ deploy:true, merge:true }), true);
  assert.deepEqual(progress.snapshot(), ['deploy','merge']);
  assert.equal(progress.next().key, 'scout');
  progress.observe({ scout:true, evolve:true, wave:true });
  assert.equal(progress.complete, true);
  assert.equal(progress.next(), null);
  assert.equal(progress.observe({ scout:true, evolve:true, wave:true }), false);
});

test('tutorial survives reordering, undo and save reload without inventing progress', () => {
  const progress = new TutorialProgress(['wave','unknown','wave','merge']);
  assert.deepEqual(progress.snapshot(), ['merge','wave']);
  progress.observe({ merge:false });
  assert.equal(progress.done.has('merge'), true, 'having practiced a merge remains true after undo');
  const restored = new TutorialProgress(progress.snapshot());
  assert.deepEqual(restored.snapshot(), progress.snapshot());
  assert.equal(restored.complete, false);
  for (const damaged of [null, {}, 'scout', 4]) assert.deepEqual(new TutorialProgress(damaged).snapshot(), []);
  assert.equal(steps.length, 5);
});

test('audio settings validate saved values and preserve independent mute controls', () => {
  assert.deepEqual(audioSettings({music:2, ambience:-1, musicMuted:true, ambienceMuted:false}), {music:1,ambience:0,musicMuted:true,ambienceMuted:false});
  for (const bad of [null, [], 'oops', {music:NaN,ambience:'0.5'}, {music:Infinity,ambience:null}]) {
    const settings=audioSettings(bad);
    assert.equal(settings.music,.38);assert.equal(settings.ambience,.28);
  }
});

test('soundscape follows combat and bosses and suspends on background or battle pause', () => {
  assert.equal(soundscape({page:'hub',paused:true}).active,true,'the paused game clock should not silence the menu');
  assert.equal(soundscape({page:'battle',paused:true,running:true}).active,false);
  assert.equal(soundscape({page:'hub',hidden:true}).active,false);
  assert.equal(soundscape({page:'battle',running:false,boss:true}).theme,'grove');
  assert.equal(soundscape({page:'battle',running:true}).theme,'frontier');
  assert.equal(soundscape({page:'battle',running:true,boss:true}).intensity,2);
  assert.equal(soundscape({page:'battle',running:true,danger:true}).theme,'storm');
});

test('each biome selects its own composition while the hub keeps the main theme', () => {
  for(const key of ['grove','wetland','ember','frost']) {
    assert.equal(soundscape({page:'battle',mapKey:key}).scoreKey,key);
    assert.equal(soundscape({page:'hub',mapKey:key}).scoreKey,'main');
    assert.equal(soundscape({page:'campaign',mapKey:key}).scoreKey,'main');
    assert.equal(soundscape({page:'battle',mapKey:key,running:true}).tempo,scores[key].tempo[1]);
    assert.equal(soundscape({page:'battle',mapKey:key,running:true,boss:true}).tempo,scores[key].tempo[2]);
  }
  assert.equal(scoreKeyFor('battle','missing'),'main');
  assert.equal(scoreKeyFor('battle','__proto__'),'main');
  assert.equal(scoreFrame({scoreKey:'__proto__'}).scoreKey,'main');
});

test('ecological scores differ in chord intervals, rhythms, melody contours and timbre rather than transposition', () => {
  const ecologies=['grove','wetland','ember','frost'];
  const intervalSignature=chords=>JSON.stringify(chords.map(chord=>chord.map(pitch=>pitch-chord[0])));
  assert.equal(new Set(ecologies.map(key=>intervalSignature(scores[key].chords))).size,4);
  assert.equal(new Set(ecologies.map(key=>JSON.stringify(scores[key].rhythm))).size,4);
  assert.equal(new Set(ecologies.map(key=>JSON.stringify(scores[key].motifs.map(motif=>motif.map((pitch,i)=>i&&pitch!==null&&motif[i-1]!==null?pitch-motif[i-1]:pitch===null?null:0))))).size,4);
  assert.equal(new Set(ecologies.map(key=>`${scores[key].lead}/${scores[key].answer}/${scores[key].pad}`)).size,4);
  assert.equal(scores.wetland.meter,6);
  assert.equal(scores.ember.meter,8);
});

test('scores have four eight-bar movements, a written breath, and variation after 32 bars', () => {
  for(const key of Object.keys(scores)) {
    const score=scores[key],frames=Array.from({length:score.meter*64},(_,pulse)=>scoreFrame({scoreKey:key,pulse,intensity:2}));
    assert.deepEqual([0,8,16,24].map(bar=>frames[bar*score.meter].section),['arrival','dialogue','reflection','return']);
    for(const bar of [7,15,23,30,31]) {
      assert.equal(frames.slice(bar*score.meter,(bar+1)*score.meter).some(frame=>frame.events.some(event=>['melody','pulse','warning'].includes(event.layer))),false,`${key} must breathe at bar ${bar}`);
    }
    const reflection=frames.slice(16*score.meter,24*score.meter);
    assert.equal(reflection.some(frame=>frame.events.some(event=>['pulse','warning','answer'].includes(event.layer))),false);
    const first=frames.slice(0,8*score.meter).map(frame=>frame.events);
    const second=frames.slice(32*score.meter,40*score.meter).map(frame=>frame.events);
    assert.notDeepEqual(first,second,`${key} changes motifs and rhythmic placement after 32 bars`);
    assert.equal(frames[32*score.meter].cycle,1);
  }
});

test('adaptive layers add accents without altering melody or accumulating density', () => {
  for(const key of Object.keys(scores)) {
    const total=scores[key].meter*32;let preparing=0,combat=0,boss=0;
    for(let pulse=0;pulse<total;pulse++) {
      const frames=[0,1,2].map(intensity=>scoreFrame({scoreKey:key,pulse,intensity}));
      const core=frame=>frame.events.filter(event=>['melody','harmony','answer','environment'].includes(event.layer));
      assert.deepEqual(core(frames[0]),core(frames[1]));assert.deepEqual(core(frames[1]),core(frames[2]));
      preparing+=frames[0].events.length;combat+=frames[1].events.length;boss+=frames[2].events.length;
    }
    assert.ok(combat>preparing);assert.ok(boss>combat);
    assert.ok(boss<preparing*1.6,`${key} boss density should remain bounded`);
  }
});

test('pure score output is deterministic, bounded and safe for synthesis across long runs', () => {
  for(const key of Object.keys(scores))for(let pulse=0;pulse<scores[key].meter*128;pulse++) {
    const options={scoreKey:key,pulse,intensity:2};const frame=scoreFrame(options);
    assert.deepEqual(frame,scoreFrame(options));
    assert.ok(frame.events.length<=8);
    for(const event of frame.events) {
      assert.ok(Number.isFinite(event.midi)&&event.midi>=28&&event.midi<=108);
      assert.ok(event.duration>0&&event.duration<=14);
      assert.ok(event.gain>0&&event.gain<=.08);
      if(event.layer==='bass')assert.ok(event.midi<55,'bass stays separate from lead register');
      if(event.layer==='melody')assert.ok(event.midi>=60,'lead stays above bass register');
    }
  }
  assert.equal(scoreFrame({pulse:NaN,intensity:Infinity}).bar,0);
  assert.equal(Object.isFrozen(scores.grove.motifs[0]),true);
});
