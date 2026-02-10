document.addEventListener("DOMContentLoaded", () => {


// ======================================================
// 1. DOM ELEMENTS
// ======================================================

// Text / number inputs
const assayNameInput = document.getElementById("assayName");
const genotypesInput = document.getElementById("genotypes");
const isiInput = document.getElementById("ISI");
const stimCountInput = document.getElementById("stimCount");
const binSizeInput = document.getElementById("binSize");

// Elements
const binWarning = document.getElementById("binWarning");
const overflowMenu = document.getElementById("overflowMenu");
const savedAssaysList = document.getElementById("savedAssaysList");
  
// Screen containers
const setupScreen = document.getElementById("setupScreen");
const assayScreen = document.getElementById("assayScreen");
const exportScreen = document.getElementById("exportScreen");
const settingsScreen = document.getElementById("settingsScreen");
const guidelinesScreen = document.getElementById("guidelinesScreen");
const savedAssaysScreen = document.getElementById("savedAssaysScreen");

// Controls
const setupForm = document.getElementById("setupForm");
const tapButton = document.getElementById("tapButton");
const genotypeSelect = document.getElementById("genotypeSelect");
const progressButton = document.getElementById("toggleProgress");
const stopRunButton = document.getElementById("stopRun");
const finishTrialButton = document.getElementById("finishTrial");
const backToAssayButton = document.getElementById("backToAssay");
const newAssayButton = document.getElementById("newAssay");
const openSettingsButton = document.getElementById("openSettings");
const overflowMenuButton = document.getElementById("overflowMenuButton");
const openSavedAssaysButton = document.getElementById("openSavedAssays");
const openGuidelinesButton = document.getElementById("openGuidelines");
const closeSettingsButton = document.getElementById("closeSettings");
const closeGuidelinesButton = document.getElementById("closeGuidelines");
const closeSavedAssaysButton = document.getElementById("closeSavedAssays");
const exportExcelButton = document.getElementById("exportExcel");


// Global audio state 
let audioCtx = null;
let audioReady = false;

// ======================================================
// 2. STATE DEFINITIONS
// ======================================================

const STATES = {
  SETUP: "setup",
  CONFIGURED: "configured",
  POISED: "poised",
  RUNNING: "running",
  EXPORT: "export"
};

let currentState = STATES.SETUP;


// ======================================================
// 3. STATE MACHINE & UI SYNCHRONIZATION
// ======================================================

function setState(nextState) {
  console.log(`STATE: ${currentState} → ${nextState}`);
  currentState = nextState;
  updateUIForState();
}

function updateUIForState() {
  setupScreen.hidden = true;
  assayScreen.hidden = true;
  exportScreen.hidden = true;

 switch (currentState) {
     
   case STATES.SETUP:
    setupScreen.hidden = false;
    break;
     
   case STATES.CONFIGURED:
    assayScreen.hidden = false;
    genotypeSelect.disabled = false;
    tapButton.disabled = false;  // start timer
    stopRunButton.disabled = true;
    finishTrialButton.disabled = true;
    progressButton.disabled = false;
    break;
   
  case STATES.POISED:
    assayScreen.hidden = false;
    genotypeSelect.disabled = false;
    tapButton.disabled = false;  // start timer
    stopRunButton.disabled = true; 
    finishTrialButton.disabled = false;
    progressButton.disabled = false;
    break;

  case STATES.RUNNING:
    assayScreen.hidden = false;
    genotypeSelect.disabled = true;
    tapButton.disabled = false; // tap
    stopRunButton.disabled = false;
    finishTrialButton.disabled = true;
    progressButton.disabled = true;
    break;   

  case STATES.EXPORT:
    exportScreen.hidden = false;
    break;  
}

}


// ======================================================
// 4. VALIDATION & BIN SIZE WARNING
// ======================================================

function inputsAreValid(values) {
  if (!values.assayName) return false;
  if (!values.genotypes.length) return false;
  if (values.isi <= 0) return false;
  if (values.stimCount <= 0) return false;
  if (values.binSize <= 0) return false;
  return true;
}

function updateBinWarning() {
  const stimCount = Number(stimCountInput.value);
  const binSize = Number(binSizeInput.value);

  if (!stimCount || !binSize) {
    binWarning.hidden = true;
    return;
  }

  const remainder = stimCount % binSize;

  if (remainder === 0) {
    binWarning.hidden = true;
  } else {
    const usableStimulations = stimCount - remainder;

    binWarning.textContent =
      `Total stimulations (${stimCount}) are not an exact multiple of bin size (${binSize}). ` +
      `Binned analysis will include the first ${usableStimulations} stimulations. ` +
      `All raw data will still be exported.`;

    binWarning.hidden = false;
  }
}

stimCountInput.addEventListener("input", updateBinWarning);
binSizeInput.addEventListener("input", updateBinWarning);


// ======================================================
// 5. SETUP SUBMISSION
// ======================================================

function populateGenotypeSelect(genotypes) {
  genotypeSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select Genotype";
  placeholder.disabled = true;
  placeholder.selected = true;
  genotypeSelect.appendChild(placeholder);

  for (const genotype of genotypes) {
    const option = document.createElement("option");
    option.value = genotype;
    option.textContent = genotype;
    genotypeSelect.appendChild(option);
  }
}

setupForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const setupValues = {
    assayName: assayNameInput.value.trim(),
    genotypes: genotypesInput.value
      .split(",")
      .map(g => g.trim())
      .filter(g => g !== ""),
    isi: Number(isiInput.value),
    stimCount: Number(stimCountInput.value),
    binSize: Number(binSizeInput.value)
  };

  if (!inputsAreValid(setupValues)) {
    alert("Please fill out all fields with valid, non-zero values.");
    return;
  }

  currentAssay = createAssay(setupValues);
  
  await saveAssay(currentAssay);
  
  // CREATE FIRST TRIAL HERE
  const firstTrial = createTrial(1);
  currentAssay.trials.push(firstTrial);
  saveTrial(currentAssay.assayId, firstTrial);
  
  populateGenotypeSelect(setupValues.genotypes);

  setState(STATES.CONFIGURED);
});


// ======================================================
// 6. DATA MODEL
// ======================================================

let currentAssay = null;

function createAssay(setupValues) {
  return {
    assayId: Date.now(),
    assayName: setupValues.assayName,
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    isi: setupValues.isi,
    stimCount: setupValues.stimCount,
    binSize: setupValues.binSize,
    genotypes: setupValues.genotypes,
    trials: []
  };
}

function createTrial(trialIndex) {
  return {
    trialIndex: trialIndex,
    trialId: Date.now(),
    status: "active",
    abandonedReason: null,
    startedAt: Date.now(),
    endedAt: null,
    runs: []
  };
}

function createRun({ genotype, animalIndex, expectedStimCount }) {
  return {
    runId: Date.now(),   
    genotype: genotype,
    animalIndex: animalIndex,
    expectedStimCount: expectedStimCount,
    values: [],
    status: "active",
    eligibleForAnalysis: null,
    ineligibleReason: null,
    touchIndexExcluded: false,
    touchIndexExclusionReason: null,
    startedAt: Date.now(),
    endedAt: null
  };
}

function getActiveTrial(assay) {
  return assay.trials.find(trial => trial.status === "active") || null;
}

function ensureActiveTrial(assay) {
  let trial = getActiveTrial(assay);

  if (!trial) {
    trial = createTrial(assay.trials.length + 1);
    assay.trials.push(trial);
    saveTrial(assay.assayId, trial);
  }

  return trial;
}


// ======================================================
// 7. RUN LIFECYCLE
// ======================================================

function startRun() {
 
  if (!currentAssay) return;

const activeTrial = getActiveTrial(currentAssay);
if (!activeTrial) {
  console.error("Invariant violated: no active trial exists");
  return;
}


  const selectedGenotype = genotypeSelect.value;

  if (!selectedGenotype) {
    alert("Please select a genotype before starting.");
    return;
  }

  const runsForGenotype = activeTrial.runs.filter(
    run => run.genotype === selectedGenotype
  );

  const animalIndex = runsForGenotype.length + 1;

  const run = createRun({
    genotype: selectedGenotype,
    animalIndex: animalIndex,
    expectedStimCount: currentAssay.stimCount
  });

  activeTrial.runs.push(run);
  saveRun(currentAssay.assayId, activeTrial.trialId, run);

  tapButton.textContent = "Tap";  

  setState(STATES.RUNNING);

  currentStimulusIndex = 0;
  tapDetectedInCurrentISI = false;
 
  startCueLoop();
}

function updateProgressTable() {
  const container = document.getElementById("assayProgress");
  container.innerHTML = "";

  if (!currentAssay) return;

  const trial = getActiveTrial(currentAssay);
  if (!trial || trial.runs.length === 0) return;

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Genotype</th>
      <th>Animal</th>
      <th>Status</th>
      <th>Eligibility</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  trial.runs.forEach(run => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${run.genotype}</td>
      <td>${run.animalIndex}</td>
      <td>${RUN_STATUS_LABELS[run.status] ?? run.status}</td>
      <td>${getEligibilityLabel(run)}</td>
    `;
    tbody.appendChild(tr);
    
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}


  function completeRunNormally() {
  const activeTrial = getActiveTrial(currentAssay);
  if (!activeTrial) return;

  const run = activeTrial.runs.find(r => r.status === "active");
  if (!run) return;

  run.status = "completed";
  run.endedAt = Date.now();

  if (run.values.length === run.expectedStimCount) {
    run.eligibleForAnalysis = true;
  } else {
    run.eligibleForAnalysis = false;
    run.ineligibleReason = "Incomplete stimulus count";
  }

  // Only bin if eligible for analysis
  if (run.eligibleForAnalysis) {
    const binned = binRunValues(run.values, currentAssay.binSize);
    run.binnedPercentages = binned;
  }
  
  updateRun(currentAssay.assayId, activeTrial.trialId, run);

  tapButton.textContent = "Start Timer";
  
  updateProgressTable();

  setState(STATES.POISED);
  
}

function stopRunEarly(reason = "Run stopped early by user") {
  stopCueLoop();
  const activeTrial = getActiveTrial(currentAssay);
  if (!activeTrial) return;

  const run = activeTrial.runs.find(r => r.status === "active");
  if (!run) return;

  run.status = "stoppedEarly";
  run.endedAt = Date.now();
  run.eligibleForAnalysis = false;
  run.ineligibleReason = reason;

  updateRun(currentAssay.assayId, activeTrial.trialId, run);

  tapButton.textContent = "Start Timer";
  
  updateProgressTable();

  setState(STATES.POISED);
  
}

async function finishTrial() {
  if (!currentAssay) return;

  const activeTrial = getActiveTrial(currentAssay);
  if (!activeTrial) return;

if (activeTrial.runs.length === 0) {
  const confirmed = confirm(
    "This trial has no runs.\n\n" +
    "It will be marked as abandoned. Continue?"
  );
  if (!confirmed) return;
  }

  activeTrial.status = "completed";
  activeTrial.endedAt = Date.now();
  markTrialCompleted(currentAssay.assayId, activeTrial.trialId);

  await hydrateAssay(currentAssay.assayId);
  console.log(
  "After hydration in finishTrial:",
  currentAssay.trials.map(t => t.trialIndex)
);
setState(STATES.EXPORT);
populateExportDatasetList(currentAssay);

}

  function startNewTrial() {
  if (!currentAssay) return;

  const activeTrial = getActiveTrial(currentAssay);
  if (activeTrial) return; // safety

  const trial = createTrial(currentAssay.trials.length + 1);
  currentAssay.trials.push(trial);
  saveTrial(currentAssay.assayId, trial);

  setState(STATES.POISED);
}



// ======================================================
// 8. EVENT WIRING
// ======================================================

  
overflowMenuButton.addEventListener("click", () => {
  overflowMenu.hidden = !overflowMenu.hidden;
});

document.addEventListener("click", (event) => {
  if (
    !overflowMenu.contains(event.target) &&
    event.target !== overflowMenuButton
  ) {
    overflowMenu.hidden = true;
  }
});

 
tapButton.addEventListener("click", () => {
  
  if (currentState === STATES.RUNNING) {
    handleTapDuringRun();
  } else {
    startRun();
  }
  if (currentState === STATES.EXPORT) return;
});



stopRunButton.addEventListener("click", stopRunEarly);
  
finishTrialButton.addEventListener("click", async () => {
  const confirmed = confirm(
    "Finish this trial?\n\n" +
    "You will not be able to add more runs to this trial.\n" +
    "Returning to the assay will start a new trial."
  );

  if (!confirmed) return;

  await finishTrial();
});


document.addEventListener("visibilitychange", () => {
  if (
    currentState === STATES.RUNNING &&
    document.visibilityState !== "visible"
  ) {
    stopRunEarly("App lost foreground focus");
  }
});

openSettingsButton.addEventListener("click", () => {
  overflowMenu.hidden = true;

  setupScreen.hidden = true;
  assayScreen.hidden = true;
  exportScreen.hidden = true;
  guidelinesScreen.hidden = true;

  settingsScreen.hidden = false;
});


closeSettingsButton.addEventListener("click", () => {
  settingsScreen.hidden = true;
  updateUIForState(); // restore previous screen
});
  
  openGuidelinesButton.addEventListener("click", () => {
  overflowMenu.hidden = true;

  setupScreen.hidden = true;
  assayScreen.hidden = true;
  exportScreen.hidden = true;
  settingsScreen.hidden = true;

  guidelinesScreen.hidden = false;
});
  
  closeGuidelinesButton.addEventListener("click", () => {
  guidelinesScreen.hidden = true;
  updateUIForState();
});
  

openSavedAssaysButton.addEventListener("click", () => {
  overflowMenu.hidden = true;

  setupScreen.hidden = true;
  assayScreen.hidden = true;
  exportScreen.hidden = true;
  settingsScreen.hidden = true;
  guidelinesScreen.hidden = true;

  savedAssaysScreen.hidden = false;
  populateSavedAssaysList();
});

  closeSavedAssaysButton.addEventListener("click", () => {
  savedAssaysScreen.hidden = true;
  updateUIForState();
});

 backToAssayButton.addEventListener("click", () => {
  startNewTrial();
});

newAssayButton.addEventListener("click", () => {
  // Clear all in-memory data
  currentAssay = null;

  // Reset form fields
  setupForm.reset();

  // Reset warnings
  binWarning.hidden = true;

  // Reset controls
  tapButton.textContent = "Start Timer";
  tapButton.disabled = true;
  finishTrialButton.disabled = true;
  stopRunButton.disabled = true;

  // Clear genotype selector
  genotypeSelect.innerHTML = "";

  // Reset internal run state
  currentStimulusIndex = 0;
  tapDetectedInCurrentISI = false;

  setState(STATES.SETUP);
});

progressButton.addEventListener("click", () => {
  const panel = document.getElementById("assayProgress");
  const visible = !panel.hidden;

  panel.hidden = visible;
  progressButton.textContent = visible
    ? "Show Progress"
    : "Hide Progress";
});
  
 exportExcelButton.addEventListener("click", () => {
   console.log("pooled TI binned is", typeof buildPooledTouchIndexBinned2D);

  if (!currentAssay) {
    alert("No assay to export.");
    return;
  }

  const checked = Array.from(
    document.querySelectorAll(
      "#exportDatasetList input[type='checkbox']:checked"
    )
  );

  if (checked.length === 0) {
    alert("Please select at least one dataset to export.");
    return;
  }

  const wb = XLSX.utils.book_new();

  checked.forEach(input => {
    const type = input.dataset.datasetType;

    // =======================
    // TRIAL EXPORT
    // =======================
    if (type === "trial") {
      const trialId = Number(input.dataset.trialId);
      const trial = currentAssay.trials.find(
        t => t.trialId === trialId
      );
      if (!trial) return;

      const trialIndex = trial.trialIndex;

      // RAW
      const raw2D = buildTrialRaw2D(trial, currentAssay);
      const rawSheet = XLSX.utils.aoa_to_sheet(raw2D);
      applySheetLayout(rawSheet, raw2D);
      XLSX.utils.book_append_sheet(
        wb,
        rawSheet,
        `Trial_${trialIndex}_Raw`
      );

      // ANALYSED (single sheet)
      const percentAnalysed2D =
        buildTrialBinned2D(trial, currentAssay);

      const tiBinned2D =
        buildTrialTouchIndexBinned2D(trial, currentAssay);

      const tiAnalysed2D =
        buildTrialTouchIndexAnalysed2D(trial, currentAssay);

      const analysed2D = buildTouchAnalysedSheet2D({
        percentAnalysed2D,
        tiBinned2D,
        tiAnalysed2D
      });

      const analysedSheet =
        XLSX.utils.aoa_to_sheet(analysed2D);

      applySheetLayout(analysedSheet, analysed2D);

      XLSX.utils.book_append_sheet(
        wb,
        analysedSheet,
        `Trial_${trialIndex}_Analysed`
      );
    }

    // =======================
    // POOLED EXPORT
    // =======================
    if (type === "pooled") {
      const includeAbandoned =
        input.dataset.includeAbandoned === "true";

      const suffix = includeAbandoned
        ? "AllTrials"
        : "CompletedTrials";

      // RAW
      const raw2D = buildPooledRaw2D(currentAssay, {
        includeAbandoned
      });
      const rawSheet = XLSX.utils.aoa_to_sheet(raw2D);
      applySheetLayout(rawSheet, raw2D);
      XLSX.utils.book_append_sheet(
        wb,
        rawSheet,
        `Pooled_${suffix}_Raw`
      );

      // ANALYSED (single sheet)
      const percentPooled2D =
        buildPooledBinned2D(currentAssay, { includeAbandoned });

      const tiPooledBinned2D =
        buildPooledTouchIndexBinned2D(currentAssay, { includeAbandoned });

      const tiPooledAnalysed2D =
        buildPooledTouchIndexAnalysed2D(currentAssay, { includeAbandoned });

      const pooledAnalysed2D = buildTouchAnalysedSheet2D({
        percentAnalysed2D: percentPooled2D,
        tiBinned2D: tiPooledBinned2D,
        tiAnalysed2D: tiPooledAnalysed2D
      });

      const pooledAnalysedSheet =
        XLSX.utils.aoa_to_sheet(pooledAnalysed2D);

      applySheetLayout(pooledAnalysedSheet, pooledAnalysed2D);

      XLSX.utils.book_append_sheet(
        wb,
        pooledAnalysedSheet,
        `Pooled_${suffix}_Analysed`
      );
    }
  }); // ← checked.forEach CLOSED

  // =======================
  // TOUCH INDEX EXCLUSIONS
  // =======================
  const tiExclusions = collectTouchIndexExclusions(currentAssay);

  if (tiExclusions.length > 0) {
    const exclusion2D = [
      ["Trial", "Genotype", "Animal", "Reason"],
      ...tiExclusions
    ];

    const exclusionSheet =
      XLSX.utils.aoa_to_sheet(exclusion2D);

    applySheetLayout(exclusionSheet, exclusion2D);

    XLSX.utils.book_append_sheet(
      wb,
      exclusionSheet,
      "TouchIndex_Exclusions"
    );
  }

  // =======================
  // WRITE FILE
  // =======================
  const filename =
    `${currentAssay.assayName || "Assay"}_Export.xlsx`;

  XLSX.writeFile(wb, filename);
});


// ======================================================
// 9. CUE ENGINE
// ======================================================

let runStartTime = null;
let cueTimerId = null;
let currentStimulusIndex = 0;
let tapDetectedInCurrentISI = false;

function startCueLoop() {
  runStartTime = performance.now();
  currentStimulusIndex = 0;
  tapDetectedInCurrentISI = false;

  cueTimerId = requestAnimationFrame(cueLoop);
}

function cueLoop(now) {
  if (
    currentState !== STATES.RUNNING ||
    !currentAssay ||
    !getActiveTrial(currentAssay)
  ) {
    stopCueLoop();
    return;
  }

  const elapsed = now - runStartTime;
  const isiMs = currentAssay.isi * 1000;

  const expectedIndex = Math.floor(elapsed / isiMs);

  // Emit at most ONE cue per frame
  if (expectedIndex > currentStimulusIndex) {
    advanceCue();
  }

  cueTimerId = requestAnimationFrame(cueLoop);
}

function advanceCue() {
  const activeTrial = getActiveTrial(currentAssay);
  if (!activeTrial) return;

  const run = activeTrial.runs.find(r => r.status === "active");
  if (!run) return;

  // Finalize previous ISI
  if (currentStimulusIndex > 0) {
    const value = tapDetectedInCurrentISI ? 0 : 1;
    run.values.push(value);
    updateRun(currentAssay.assayId, activeTrial.trialId, run);
  }

  tapDetectedInCurrentISI = false;
  currentStimulusIndex++;

  // Completion check (data-driven)
  if (run.values.length === run.expectedStimCount) {
    stopCueLoop();
    completeRunNormally();
    return;
  }

  // Start next ISI
  playVoiceCue(currentStimulusIndex);
}

function stopCueLoop() {
  if (cueTimerId !== null) {
    cancelAnimationFrame(cueTimerId);
    cueTimerId = null;
  }
}

function handleTapDuringRun() {
  if (currentState !== STATES.RUNNING) return;
  tapDetectedInCurrentISI = true;
}


 
// ======================================================
// 10. VOICEOVER (TICK VIA WEB AUDIO, SPEECH VIA TTS)
// ======================================================

// ---------- STATE ----------
let voiceMode = "tick";
let selectedVoice = null;

// ---------- SPEECH VOICES ----------
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  selectedVoice =
    voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) ||
    voices[0] ||
    null;
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// ---------- SPEECH ----------
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  speechSynthesis.speak(utterance);
}

function stopSpeech() {
  speechSynthesis.cancel();
}

// ---------- WEB AUDIO TICK ----------

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}


// ---------- CUE DISPATCH ----------
function playVoiceCue(stimulusIndex) {
  // Speech not reliable for ISI < 1s
  if (voiceMode === "count" && currentAssay.isi < 1) {
    playTick();
    return;
  }

  switch (voiceMode) {
    case "tick":
      playTick();
      break;

    case "count":
      speak(String(stimulusIndex));
      break;

    case "tens":
      if (stimulusIndex % 10 === 0) {
        speak(String(stimulusIndex));
      } else {
        playTick();
      }
      break;
  }
}

// ---------- MODE SELECTION ----------
const voiceModeInputs = document.querySelectorAll(
  'input[name="voiceMode"]'
);

voiceModeInputs.forEach(input => {
  if (input.checked) {
    voiceMode = input.value;
  }

  input.addEventListener("change", () => {
    if (input.checked) {
      stopSpeech(); // cancel speech only on mode change
      voiceMode = input.value;
    }
  });
});

function playTick() {
  const ctx = getAudioContext();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = 900;

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.05 // 50 ms
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}



// ======================================================
// 11. HELPERS
// ======================================================

function warmUpAudio() {
  if (audioReady) return;

  const ctx = getAudioContext();
  ctx.resume().then(() => {
    audioReady = true;
  });
}

  
  function getEligibilityLabel(run) {
  if (run.status === "completed" && run.eligibleForAnalysis) {
    return "Eligible";
  }
    return "Ineligible";
  }

  function binRunValues(values, binSize) {
  const totalValues = values.length;

  const usableValueCount =
    Math.floor(totalValues / binSize) * binSize;

  const usableValues = values.slice(0, usableValueCount);

  const binnedPercentages = [];

  for (let i = 0; i < usableValues.length; i += binSize) {
    const bin = usableValues.slice(i, i + binSize);
    const sum = bin.reduce((acc, v) => acc + v, 0);
    const percentage = (sum / binSize) * 100;
    binnedPercentages.push(percentage);
  }

  return binnedPercentages;
}

const RUN_STATUS_LABELS = {
  completed: "Completed",
  stoppedEarly: "Stopped Early",
  abandoned: "Abandoned"
};

function collectPooledRuns(assay, options = {}) {
  const {
    includeAbandoned = false
  } = options;

  const pooled = [];

  assay.trials.forEach(trial => {
    if (
      trial.status !== "completed" &&
      !includeAbandoned
    ) {
      return;
    }

    trial.runs.forEach(run => {
      pooled.push({
        ...run,
        trialIndex: trial.trialIndex
      });
    });
  });

  return pooled;
}

function applySheetLayout(sheet, data) {
  // 1. column widths
  sheet["!cols"] = data[0].map((_, colIndex) => {
    // first column = row labels
    if (colIndex === 0) return { wch: 22 };

    // data columns
    return { wch: 10 };
  });

  // 2. wrap text for all cells
  Object.keys(sheet).forEach(addr => {
    if (addr[0] === "!") return; // skip metadata
    const cell = sheet[addr];
    cell.s = cell.s || {};
    cell.s.alignment = { wrapText: true };
  });
}

function abandonActiveTrial(reason = "App closed or reloaded") {
  const trial = getActiveTrial(currentAssay);
  if (!trial) return;

  trial.status = "abandoned";
  trial.abandonedReason = reason;
  trial.endedAt = Date.now();

  markTrialCompleted(currentAssay.assayId, trial.trialId);
}

function populateExportDatasetList(assay) {
  const container = document.getElementById("exportDatasetList");
  container.innerHTML = "";

  if (!assay || !assay.trials) return;

  // ----- Trials -----
assay.trials.forEach(trial => {
  const label = document.createElement("label");

  const isCompleted = trial.status === "completed";
  const isAbandoned = trial.status === "abandoned";

  const totalRunCount = trial.runs.length;
  const eligibleRunCount = trial.runs.filter(
    r => r.eligibleForAnalysis
  ).length;

  label.innerHTML = `
    <input
      type="checkbox"
      data-dataset-type="trial"
      data-trial-id="${trial.trialId}"
      ${isCompleted ? "checked" : ""}
    >
    Trial ${trial.trialIndex} —
    ${eligibleRunCount} eligible run${eligibleRunCount !== 1 ? "s" : ""}
    (${totalRunCount} total)
    ${isAbandoned ? " (abandoned)" : ""}
  `;

  container.appendChild(label);
});


  // ----- Pooled (completed trials only) -----
  const pooledCompleted = document.createElement("label");
  pooledCompleted.innerHTML = `
    <input
      type="checkbox"
      data-dataset-type="pooled"
      data-include-abandoned="false"
      checked
    >
    Pooled (completed trials only)
  `;
  container.appendChild(pooledCompleted);

  // ----- Pooled (include abandoned trials) -----
  const pooledAll = document.createElement("label");
  pooledAll.innerHTML = `
    <input
      type="checkbox"
      data-dataset-type="pooled"
      data-include-abandoned="true"
    >
    Pooled (include abandoned trials)
  `;
  container.appendChild(pooledAll);
}

async function populateSavedAssaysList() {
  const assays = await loadAllAssays();

  savedAssaysList.innerHTML = "";

  if (assays.length === 0) {
    savedAssaysList.textContent = "No saved assays.";
    return;
  }

  // most recent first
  assays.sort((a, b) => b.createdAt - a.createdAt);

  assays.forEach(assay => {
    const row = document.createElement("div");

    const title = document.createElement("div");
   const createdDate = new Date(assay.createdAt);

   title.textContent =
  `${assay.assayName || "Untitled Assay"} — ` +
  createdDate.toLocaleString();


    const startBtn = document.createElement("button");
    startBtn.textContent = "Start New Trial";
    startBtn.addEventListener("click", async () => {
  await hydrateAssay(assay.assayId);

  // sync UI with hydrated assay
  populateGenotypeSelect(currentAssay.genotypes);

  // abandon active trial if present
  const activeTrial = getActiveTrial(currentAssay);
  if (activeTrial) {
    activeTrial.status = "abandoned";
    activeTrial.endedAt = Date.now();
    markTrialCompleted(currentAssay.assayId, activeTrial.trialId);
  }

  // create new trial
  const newTrial = createTrial(currentAssay.trials.length + 1);
  currentAssay.trials.push(newTrial);
  saveTrial(currentAssay.assayId, newTrial);

  savedAssaysScreen.hidden = true;
  setState(STATES.POISED);
});

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", async () => {
  await hydrateAssay(assay.assayId);

  savedAssaysScreen.hidden = true;
  setState(STATES.EXPORT);
  populateExportDatasetList(currentAssay);
});


    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      const confirmed = confirm(
        `Delete assay "${assay.assayName}"?\n\nThis cannot be undone.`
      );
      if (!confirmed) return;

      deleteAssay(assay.assayId).then(populateSavedAssaysList);
    });

    row.appendChild(title);
    row.appendChild(startBtn);
    row.appendChild(exportBtn);
    row.appendChild(deleteBtn);

    savedAssaysList.appendChild(row);
  });
}

function computeTouchIndexBins(binnedPercentages) {
  const baseline = binnedPercentages[0];

  if (baseline === 0 || baseline == null) {
    return null;
  }

  return binnedPercentages.map(v => v / baseline);
}
  function collectTouchIndexExclusions(assay) {
  const rows = [];

  assay.trials.forEach(trial => {
    trial.runs.forEach(run => {
      if (run.touchIndexExcluded) {
        rows.push([
          trial.trialIndex,
          run.genotype,
          run.animalIndex,
          run.touchIndexExclusionReason
        ]);
      }
    });
  });

  return rows;
}


// ======================================================
// 12. EXPORT BUILDERS
// ======================================================

function buildTrialRaw2D(trial, assay) {
  const { stimCount, genotypes } = assay;

  // 1. Group runs by genotype
  const runsByGenotype = {};
  genotypes.forEach(g => {
    runsByGenotype[g] = [];
  });

  trial.runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  // 2. Sort runs within each genotype by trial-local animal index
  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) => a.animalIndex - b.animalIndex
    );
  });

  // 3. Build header rows
  const headerGenotype = ["Genotype"];
  const headerAnimal = ["Animal"];
  const headerStatus = ["Run Status"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach(run => {
      headerGenotype.push(g);
      headerAnimal.push(`Animal ${run.animalIndex}`);
      headerStatus.push(RUN_STATUS_LABELS[run.status] ?? run.status);
    });

    // blank column between genotypes (not after last)
    if (gi < genotypes.length - 1) {
      headerGenotype.push("");
      headerAnimal.push("");
      headerStatus.push("");
    }
  });

  // 4. Build data rows
  const rows = [];

  for (let i = 0; i < stimCount; i++) {
    const row = [`Stimulus ${i + 1}`];

    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        row.push(
          i < run.values.length ? run.values[i] : ""
        );
      });

      if (gi < genotypes.length - 1) {
        row.push("");
      }
    });

    rows.push(row);
  }

  // 5. Assemble full table
  return [
    headerGenotype,
    headerAnimal,
    headerStatus,
    ...rows
  ];
}


function buildTrialBinned2D(trial, assay) {
  const { genotypes, binSize } = assay;

  // ---------- group runs by genotype ----------
  const runsByGenotype = {};
  genotypes.forEach(g => {
    runsByGenotype[g] = [];
  });

  trial.runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  // ---------- sort runs within genotype ----------
  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) => a.animalIndex - b.animalIndex
    );
  });

  // ---------- header rows ----------
  const headerGenotype = ["Genotype"];
  const headerAnimal = ["Animal"];
  const headerStatus = ["Run Status"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach(run => {
      headerGenotype.push(g);
      headerAnimal.push(`Animal ${run.animalIndex}`);
      headerStatus.push(
        RUN_STATUS_LABELS[run.status] ?? run.status
      );
    });

    if (gi < genotypes.length - 1) {
      headerGenotype.push("");
      headerAnimal.push("");
      headerStatus.push("");
    }
  });

  // ---------- precompute binned values per run ----------
  const binnedByRun = new Map();
  let maxBinCount = 0;

  trial.runs.forEach(run => {
    const bins = binRunValues(run.values, binSize);
    binnedByRun.set(run, bins);
    maxBinCount = Math.max(maxBinCount, bins.length);
  });

  // ---------- build binned rows ----------
  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end   = start + binSize - 1;

    const row = [`Bin ${binIndex + 1} (${start}–${end})`];


    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        row.push(
          binIndex < bins.length ? bins[binIndex] : ""
        );
      });

      if (gi < genotypes.length - 1) {
        row.push("");
      }
    });

    rows.push(row);
  }

  // ---------- summary table ----------
  const summaryHeader = ["Bin"];
  genotypes.forEach(g => {
    summaryHeader.push(`${g}_Mean`, `${g}_SEM`);
  });

  const summaryRows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end   = start + binSize - 1;
   
    const row = [`Bin ${binIndex + 1} (${start}–${end})`];

    genotypes.forEach(g => {
      const values = [];

      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        if (binIndex < bins.length) {
          values.push(bins[binIndex]);
        }
      });

      if (values.length === 0) {
        row.push("", "");
      } else {
        const mean =
          values.reduce((a, b) => a + b, 0) / values.length;

        const variance =
          values.reduce((a, v) => a + (v - mean) ** 2, 0) /
          values.length;

        const sem = Math.sqrt(variance) / Math.sqrt(values.length);

        row.push(mean, sem);
      }
    });

    summaryRows.push(row);
  }

  // ---------- assemble ----------
  return [
    headerGenotype,
    headerAnimal,
    headerStatus,
    ...rows,
    ["", "", ""],   // blank
    ["", "", ""],   // blank
    ["", "", ""],   // blank
    summaryHeader,
    ...summaryRows
  ];
}
  
  function buildTrialTouchIndexBinned2D(trial, assay) {
  const { genotypes, binSize } = assay;

  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  trial.runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) => a.animalIndex - b.animalIndex
    );
  });

  const headerGenotype = ["Genotype"];
  const headerAnimal = ["Animal"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach(run => {
      headerGenotype.push(g);
      headerAnimal.push(`Animal ${run.animalIndex}`);
    });

    if (gi < genotypes.length - 1) {
      headerGenotype.push("");
      headerAnimal.push("");
    }
  });

  const binnedByRun = new Map();
  let maxBinCount = 0;

trial.runs.forEach(run => {
  const binned = binRunValues(run.values, binSize);
  const ti = computeTouchIndexBins(binned);

  if (ti) {
    run.touchIndexExcluded = false;
    run.touchIndexExclusionReason = null;

    binnedByRun.set(run, ti);
    maxBinCount = Math.max(maxBinCount, ti.length);
  } else {
    run.touchIndexExcluded = true;
    run.touchIndexExclusionReason = "Baseline bin = 0";
  }
});


  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end = start + binSize - 1;

    const row = [`Bin ${binIndex + 1} (${start}–${end})`];

    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        row.push(bins && binIndex < bins.length ? bins[binIndex] : "");
      });

      if (gi < genotypes.length - 1) row.push("");
    });

    rows.push(row);
  }

  return [
    headerGenotype,
    headerAnimal,
    ...rows
  ];
}

  function buildTrialTouchIndexAnalysed2D(trial, assay) {
  const { genotypes, binSize } = assay;

  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  trial.runs.forEach(run => {
  const binned = binRunValues(run.values, binSize);
  const ti = computeTouchIndexBins(binned);

  if (ti && runsByGenotype[run.genotype]) {
    run.touchIndexExcluded = false;
    run.touchIndexExclusionReason = null;

    runsByGenotype[run.genotype].push(ti);
  } else {
    run.touchIndexExcluded = true;
    run.touchIndexExclusionReason = "Baseline bin = 0";
  }
});


  const maxBinCount = Math.max(
    ...Object.values(runsByGenotype).flat().map(r => r.length),
    0
  );

  const header = ["Bin"];
  genotypes.forEach(g => {
    header.push(`${g}_Mean`, `${g}_SEM`);
  });

  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end = start + binSize - 1;

    const row = [`Bin ${binIndex + 1} (${start}–${end})`];

    genotypes.forEach(g => {
      const values = runsByGenotype[g]
        .map(r => r[binIndex])
        .filter(v => v != null);

      if (values.length === 0) {
        row.push("", "");
      } else {
        const mean =
          values.reduce((a, b) => a + b, 0) / values.length;

        const variance =
          values.reduce((a, v) => a + (v - mean) ** 2, 0) /
          values.length;

        const sem = Math.sqrt(variance) / Math.sqrt(values.length);

        row.push(mean, sem);
      }
    });

    rows.push(row);
  }

  return [header, ...rows];
}


function buildPooledRaw2D(assay, options = {}) {
  const { stimCount, genotypes } = assay;

  const runs = collectPooledRuns(assay, options);

  // group by genotype
  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  // sort + assign global animal index
  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) =>
        a.trialIndex - b.trialIndex ||
        a.animalIndex - b.animalIndex
    );

    runsByGenotype[g].forEach((run, i) => {
      run.globalAnimalIndex = i + 1;
    });
  });

  // headers
  const hGenotype = ["Genotype"];
  const hAnimal = ["Animal"];
  const hTrial = ["Trial"];
  const hTrialAnimal = ["Trial Animal"];
  const hStatus = ["Run Status"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach(run => {
      hGenotype.push(g);
      hAnimal.push(`Animal ${run.globalAnimalIndex}`);
      hTrial.push(`Trial ${run.trialIndex}`);
      hTrialAnimal.push(`Animal ${run.animalIndex}`);
      hStatus.push(RUN_STATUS_LABELS[run.status] ?? run.status);
    });

    if (gi < genotypes.length - 1) {
      [hGenotype, hAnimal, hTrial, hTrialAnimal, hStatus].forEach(h => h.push(""));
    }
  });

  // data rows
  const rows = [];

  for (let i = 0; i < stimCount; i++) {
    const row = [`Stimulus ${i + 1}`];

    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        row.push(i < run.values.length ? run.values[i] : "");
      });

      if (gi < genotypes.length - 1) row.push("");
    });

    rows.push(row);
  }

  return [
    hGenotype,
    hAnimal,
    hTrial,
    hTrialAnimal,
    hStatus,
    ...rows
  ];
}

function buildPooledBinned2D(assay, options = {}) {
  const { genotypes, binSize } = assay;

  const runs = collectPooledRuns(assay, options);

  // ---------- group runs by genotype ----------
  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  // ---------- sort + assign global animal index ----------
  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) =>
        a.trialIndex - b.trialIndex ||
        a.animalIndex - b.animalIndex
    );

    runsByGenotype[g].forEach((run, i) => {
      run.globalAnimalIndex = i + 1;
    });
  });

  // ---------- header rows ----------
  const hGenotype = ["Genotype"];
  const hAnimal = ["Animal"];
  const hTrial = ["Trial"];
  const hTrialAnimal = ["Trial Animal"];
  const hStatus = ["Run Status"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach(run => {
      hGenotype.push(g);
      hAnimal.push(`Animal ${run.globalAnimalIndex}`);
      hTrial.push(`Trial ${run.trialIndex}`);
      hTrialAnimal.push(`Animal ${run.animalIndex}`);
      hStatus.push(RUN_STATUS_LABELS[run.status] ?? run.status);
    });

    if (gi < genotypes.length - 1) {
      [hGenotype, hAnimal, hTrial, hTrialAnimal, hStatus]
        .forEach(h => h.push(""));
    }
  });

  // ---------- precompute binned values ----------
  const binnedByRun = new Map();
  let maxBinCount = 0;

  runs.forEach(run => {
    const bins = binRunValues(run.values, binSize);
    binnedByRun.set(run, bins);
    maxBinCount = Math.max(maxBinCount, bins.length);
  });

  // ---------- binned rows ----------
  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
   const start = binIndex * binSize + 1;
   const end = start + binSize - 1;

   const row = [`Bin ${binIndex + 1} (${start}–${end})`];


    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        row.push(
          binIndex < bins.length ? bins[binIndex] : ""
        );
      });

      if (gi < genotypes.length - 1) row.push("");
    });

    rows.push(row);
  }

  // ---------- summary table ----------
  const summaryHeader = ["Bin"];
  genotypes.forEach(g => {
    summaryHeader.push(`${g}_Mean`, `${g}_SEM`);
  });

  const summaryRows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
  const start = binIndex * binSize + 1;
  const end   = start + binSize - 1;

  const row = [`Bin ${binIndex + 1} (${start}–${end})`];


    genotypes.forEach(g => {
      const values = [];

      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        if (binIndex < bins.length) {
          values.push(bins[binIndex]);
        }
      });

      if (values.length === 0) {
        row.push("", "");
      } else {
        const mean =
          values.reduce((a, b) => a + b, 0) / values.length;

        const variance =
          values.reduce((a, v) => a + (v - mean) ** 2, 0) /
          values.length;

        const sem = Math.sqrt(variance) / Math.sqrt(values.length);

        row.push(mean, sem);
      }
    });

    summaryRows.push(row);
  }

  // ---------- assemble ----------
  return [
    hGenotype,
    hAnimal,
    hTrial,
    hTrialAnimal,
    hStatus,
    ...rows,
    ["", ""],   // blank
    ["", ""],   // blank
    ["", ""],   // blank
    summaryHeader,
    ...summaryRows
  ];
}

// // NOTE: CSV export kept for future R workflows; not used in v1 UI

function array2DToCSV(data) {
  return data
    .map(row =>
      row
        .map(cell => {
          if (cell === null || cell === undefined) return "";
          const str = String(cell);
          // escape quotes
          if (str.includes('"') || str.includes(",") || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");
}

function downloadCSV(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// end csv (two functions) 

function sheetFrom2DArray(data) {
  return XLSX.utils.aoa_to_sheet(data);
}

function buildPooledTouchIndexBinned2D(assay, options = {}) {
  const { genotypes, binSize } = assay;
  const runs = collectPooledRuns(assay, options);

  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  runs.forEach(run => {
    if (runsByGenotype[run.genotype]) {
      runsByGenotype[run.genotype].push(run);
    }
  });

  // sort + assign global index
  genotypes.forEach(g => {
    runsByGenotype[g].sort(
      (a, b) =>
        a.trialIndex - b.trialIndex ||
        a.animalIndex - b.animalIndex
    );
  });

  const headerGenotype = ["Genotype"];
  const headerAnimal = ["Animal"];

  genotypes.forEach((g, gi) => {
    runsByGenotype[g].forEach((run, i) => {
      headerGenotype.push(g);
      headerAnimal.push(`Animal ${i + 1}`);
    });

    if (gi < genotypes.length - 1) {
      headerGenotype.push("");
      headerAnimal.push("");
    }
  });

  const binnedByRun = new Map();
  let maxBinCount = 0;

  runs.forEach(run => {
    const binned = binRunValues(run.values, binSize);
    const ti = computeTouchIndexBins(binned);

    if (ti) {
      run.touchIndexExcluded = false;
      run.touchIndexExclusionReason = null;

      binnedByRun.set(run, ti);
      maxBinCount = Math.max(maxBinCount, ti.length);
    } else {
      run.touchIndexExcluded = true;
      run.touchIndexExclusionReason = "Baseline bin = 0";
    }
  });

  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end = start + binSize - 1;

    const row = [`Bin ${binIndex + 1} (${start}–${end})`];

    genotypes.forEach((g, gi) => {
      runsByGenotype[g].forEach(run => {
        const bins = binnedByRun.get(run);
        row.push(bins && binIndex < bins.length ? bins[binIndex] : "");
      });

      if (gi < genotypes.length - 1) row.push("");
    });

    rows.push(row);
  }

  return [
    headerGenotype,
    headerAnimal,
    ...rows
  ];
}
  

function buildPooledTouchIndexAnalysed2D(assay, options = {}) {
  const { genotypes, binSize } = assay;
  const runs = collectPooledRuns(assay, options);

  const runsByGenotype = {};
  genotypes.forEach(g => (runsByGenotype[g] = []));

  runs.forEach(run => {
    const binned = binRunValues(run.values, binSize);
    const ti = computeTouchIndexBins(binned);

    if (ti && runsByGenotype[run.genotype]) {
      run.touchIndexExcluded = false;
      run.touchIndexExclusionReason = null;

      runsByGenotype[run.genotype].push(ti);
    } else {
      run.touchIndexExcluded = true;
      run.touchIndexExclusionReason = "Baseline bin = 0";
    }
  });

  const maxBinCount = Math.max(
    ...Object.values(runsByGenotype).flat().map(r => r.length),
    0
  );

  const header = ["Bin"];
  genotypes.forEach(g => {
    header.push(`${g}_Mean`, `${g}_SEM`);
  });

  const rows = [];

  for (let binIndex = 0; binIndex < maxBinCount; binIndex++) {
    const start = binIndex * binSize + 1;
    const end = start + binSize - 1;

    const row = [`Bin ${binIndex + 1} (${start}–${end})`];

    genotypes.forEach(g => {
      const values = runsByGenotype[g]
        .map(r => r[binIndex])
        .filter(v => v != null);

      if (values.length === 0) {
        row.push("", "");
      } else {
        const mean =
          values.reduce((a, b) => a + b, 0) / values.length;

        const variance =
          values.reduce((a, v) => a + (v - mean) ** 2, 0) /
          values.length;

        const sem = Math.sqrt(variance) / Math.sqrt(values.length);

        row.push(mean, sem);
      }
    });

    rows.push(row);
  }

  return [header, ...rows];
}

function buildTouchAnalysedSheet2D({
  percentAnalysed2D,
  tiBinned2D,
  tiAnalysed2D
}) {
  const out = [];

  // helper to append a table with spacing
  function append(table) {
    if (!table || table.length === 0) return;
    if (out.length > 0) out.push([], []); // spacing between sections
    table.forEach(row => out.push(row));
  }

  append(percentAnalysed2D); // % binned + % analysed
  append(tiBinned2D);        // touch index binned
  append(tiAnalysed2D);      // touch index analysed

  return out;
}

// ======================================================
// 13. INDEXEDDB PERSISTENCE
// ======================================================

const DB_NAME = "touch-assay-db";
const DB_VERSION = 1;

const STORES = {
  ASSAYS: "assays",
  TRIALS: "trials",
  RUNS: "runs"
};

function openDB() {
  console.log("openDB called");
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = event => {
      console.log("onupgradeneeded fired");
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.ASSAYS)) {
        db.createObjectStore(STORES.ASSAYS, { keyPath: "assayId" });
      }

      if (!db.objectStoreNames.contains(STORES.TRIALS)) {
        const store = db.createObjectStore(STORES.TRIALS, {
          keyPath: "trialId"
        });
        store.createIndex("assayId", "assayId", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.RUNS)) {
        const store = db.createObjectStore(STORES.RUNS, {
          keyPath: "runId"
        });
        store.createIndex("trialId", "trialId", { unique: false });
        store.createIndex("genotype", "genotype", { unique: false });
      }
    };

    req.onsuccess = () => {
      console.log("IndexedDB opened", req.result.name);
      resolve(req.result);
    };

    req.onerror = () => {
      console.error("IndexedDB open error", req.error);
      reject(req.error);
    };
  });
}

// ---------- Assays ----------

async function saveAssay(assay) {
  const db = await openDB();
  const tx = db.transaction(STORES.ASSAYS, "readwrite");
  tx.objectStore(STORES.ASSAYS).put(assay);
  return tx.complete;
}

async function loadAllAssays() {
  const db = await openDB();
  const tx = db.transaction(STORES.ASSAYS, "readonly");
  const req = tx.objectStore(STORES.ASSAYS).getAll();

  return new Promise(resolve => {
    req.onsuccess = () => resolve(req.result || []);
  });
}
  
async function hydrateAssay(assayId) {
  const db = await openDB();

  // ---- load assay ----
  const assay = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ASSAYS, "readonly");
    const req = tx.objectStore(STORES.ASSAYS).get(assayId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!assay) {
    throw new Error("Assay not found: " + assayId);
  }

  // ---- load trials for assay ----
  const trials = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRIALS, "readonly");
    const index = tx.objectStore(STORES.TRIALS).index("assayId");
    const req = index.getAll(assayId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // ---- load runs per trial ----
  for (const trial of trials) {
    const runs = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RUNS, "readonly");
      const index = tx.objectStore(STORES.RUNS).index("trialId");
      const req = index.getAll(trial.trialId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    trial.runs = runs;
  }

  // ---- attach and finalize ----
  assay.trials = trials;

  currentAssay = assay;
  return assay;
}


async function deleteAssay(assayId) {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.ASSAYS, STORES.TRIALS, STORES.RUNS],
    "readwrite"
  );

  tx.objectStore(STORES.ASSAYS).delete(assayId);

  const trialsStore = tx.objectStore(STORES.TRIALS);
  const runsStore = tx.objectStore(STORES.RUNS);

  const trialsReq = trialsStore.index("assayId").getAll(assayId);
  trialsReq.onsuccess = () => {
    trialsReq.result.forEach(trial => {
      trialsStore.delete(trial.trialId);

      const runsReq = runsStore.index("trialId").getAll(trial.trialId);
      runsReq.onsuccess = () => {
        runsReq.result.forEach(run =>
          runsStore.delete(run.runId)
        );
      };
    });
  };

  return tx.complete;
}

// ---------- Trials ----------

async function saveTrial(assayId, trial) {
  const db = await openDB();
  const tx = db.transaction(STORES.TRIALS, "readwrite");
  tx.objectStore(STORES.TRIALS).put({ ...trial, assayId });
  return tx.complete;
}

async function markTrialCompleted(assayId, trialId) {
  const db = await openDB();
  const tx = db.transaction(STORES.TRIALS, "readwrite");
  const store = tx.objectStore(STORES.TRIALS);

  const req = store.get(trialId);
  req.onsuccess = () => {
    const trial = req.result;
    if (!trial) return;
    trial.status = "completed";
    trial.endedAt = Date.now();
    store.put(trial);
  };

  return tx.complete;
}

async function markTrialAbandoned(
  assayId,
  trialId,
  reason = "App closed or reloaded"
) {
  const db = await openDB();
  const tx = db.transaction(STORES.TRIALS, "readwrite");
  const store = tx.objectStore(STORES.TRIALS);

  const req = store.get(trialId);
  req.onsuccess = () => {
    const trial = req.result;
    if (!trial) return;
    trial.status = "abandoned";
    trial.abandonedReason = reason;
    trial.endedAt = Date.now();
    store.put(trial);
  };

  return tx.complete;
}

// ---------- Runs ----------

async function saveRun(assayId, trialId, run) {
  const db = await openDB();
  const tx = db.transaction(STORES.RUNS, "readwrite");
  tx.objectStore(STORES.RUNS).put({
    ...run,
    trialId
  });
  return tx.complete;
}

async function updateRun(assayId, trialId, run) {
  if (!run.runId) {
  console.error("Invariant violated: run has no runId", run);
  return;
}
  const db = await openDB();
  const tx = db.transaction(STORES.RUNS, "readwrite");
  
    tx.objectStore(STORES.RUNS).put({
    ...run,
    trialId
  }); 

   return tx.complete;
}

  window.__debug = {
  saveRun,
  updateRun,
  openDB,
  hydrateAssay,
  currentAssay: () => currentAssay
};

console.log("END OF DOMContentLoaded — VERIFIED");


});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}
