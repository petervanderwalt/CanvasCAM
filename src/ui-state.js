export function refreshOperationUi(ui) {
  for (const option of ui.operationOptions) {
    option.classList.toggle("active", option.dataset.operation === ui.toolpathTypeInput.value);
  }
}

export function refreshToolpathFieldVisibility(ui) {
  const operation = ui.toolpathTypeInput.value;
  const isPocket = operation === "pocket";
  const isVCarve = operation === "vcarve";
  const isChamfer = operation === "chamfer";
  const isLaserRaster = operation === "laser-raster";
  const isLaserCut = operation === "laser-cut";
  const isWavy = operation === "wavy-raster";
  const isHalftone = operation === "halftone";
  const isLaser = isLaserRaster || isLaserCut;
  const isBitmapRaster = isLaserRaster || isWavy || isHalftone;
  const usesTabs = operation === "profile-outside" || operation === "profile-inside" || operation === "laser-cut";
  const passDepthGroup = ui.passDepthInput?.closest(".col-6");

  ui.overlapField.classList.toggle("d-none", !isPocket);
  ui.cutterAngleField.classList.toggle("d-none", !isVCarve);
  ui.toolDiameterField.classList.toggle("d-none", isVCarve || isChamfer || isLaser);
  // hide depth/tool for laser raster/cut and wavy (they use S/power or wavyMin/Max, not Z)
  const hideDepthForLaser = isLaserRaster || isLaserCut || isWavy;
  ui.cutDepthField?.classList.toggle("d-none", isVCarve || hideDepthForLaser);
  passDepthGroup?.classList.toggle("d-none", isVCarve || hideDepthForLaser);
  // hide whole depth section when no depth fields visible
  const depthSection = ui.cutDepthField?.closest(".sidebar-flow-section");
  if (depthSection) {
    const hasVisibleDepth = !ui.cutDepthField?.classList.contains("d-none") || !passDepthGroup?.classList.contains("d-none");
    depthSection.classList.toggle("d-none", isVCarve || hideDepthForLaser);
    // for wavy/laser, depth section is entirely hidden, so hasVisibleDepth is false
  }
  // hide Endmill selector for laser
  const toolSection = document.getElementById("myEndmillSelect")?.closest(".sidebar-flow-section");
  if (toolSection) toolSection.classList.toggle("d-none", isLaser);
  document.getElementById("laserRasterFields")?.classList.toggle("d-none", !isLaserRaster);
  document.getElementById("wavyFields")?.classList.toggle("d-none", !isWavy);
  // wavy is CNC but depth is per-pixel wavyMin/Max, not Final Depth/Pass Depth
  if (isWavy) {
    ui.toolDiameterField.classList.remove("d-none");
  }
  ui.tabWidthField.classList.toggle("d-none", !usesTabs);
  ui.tabHeightField.classList.toggle("d-none", !usesTabs);
  ui.trochoidSettingsSection?.classList.toggle("d-none", !usesTabs);
  ui.trochoidEngagementField?.classList.toggle("d-none", !usesTabs || !ui.trochoidEnabledInput?.checked);
  ui.jobSettingsSection?.classList.toggle("d-none", !usesTabs);
  passDepthGroup?.classList.toggle("d-none", isVCarve || hideDepthForLaser);
}

export function refreshSelectionUi({
  state,
  ui,
  editing,
  refreshOperationUiFn,
  refreshToolpathFieldVisibilityFn,
  rebuildDraftToolpath,
}) {
  const count = state.selectedLoopIds.size;
  // detect bitmap vs vector selection
  const hasBitmap = (() => {
    for (const id of state.selectedLoopIds) {
      const loop = state.loops.find((l) => l.id === id);
      if (loop?.isBitmap) return true;
      const idx = loop?.sourceEntityIndexes?.[0];
      if (idx != null && state.entities[idx]?.type === "BITMAP") return true;
    }
    return false;
  })();
  const hasVector = (() => {
    for (const id of state.selectedLoopIds) {
      const loop = state.loops.find((l) => l.id === id);
      if (loop && !loop.isBitmap) return true;
    }
    return false;
  })();
  // show/hide operation buttons based on selection type
  for (const opt of ui.operationOptions) {
    const op = opt.dataset.operation;
    const isBitmapOp = op === "laser-raster" || op === "wavy-raster" || op === "halftone";
    const isVectorOp = op === "profile-outside" || op === "profile-inside" || op === "pocket" || op === "engrave" || op === "chamfer" || op === "vcarve" || op === "laser-cut";
    if (hasBitmap && !hasVector) {
      // bitmap only -> show only raster ops, hide CNC vector ops
      opt.classList.toggle("d-none", !isBitmapOp);
    } else if (!hasBitmap && hasVector) {
      // vector only -> raster is for bitmaps, hide it (would need inside-fill clipping, not bounding-box)
      opt.classList.toggle("d-none", isBitmapOp);
    } else if (hasBitmap && hasVector) {
      // mixed — show all, user can pick
      opt.classList.remove("d-none");
    } else {
      opt.classList.remove("d-none");
    }
  }

  ui.selectionCount.textContent = String(count);
  ui.selectionHeading.textContent = editing ? "Edit Toolpath" : "Assign Toolpaths";
  ui.selectionEmpty.classList.toggle("d-none", count > 0 || Boolean(editing));
  ui.toolpathForm.classList.toggle("d-none", count === 0 && !editing);
  ui.cancelEditBtn.classList.toggle("d-none", !editing);
  ui.toolpathSubmitBtn.textContent = editing ? "Update Toolpath" : "Add Toolpath";
  if (hasBitmap && !hasVector) {
    ui.toolpathFormMode.textContent = editing
      ? `Editing ${editing.label}.`
      : count > 0
        ? `${count} bitmap${count === 1 ? "" : "s"} selected: Choose raster engraving`
        : "";
  } else {
    ui.toolpathFormMode.textContent = editing
      ? `Editing ${editing.label}.`
      : count > 0
        ? `${count} vector${count === 1 ? "" : "s"} selected: How would you like to cut these?`
        : "";
  }
  if (!editing && count > 0 && !ui.toolpathTypeInput.value) {
    if (hasBitmap && !hasVector) ui.toolpathTypeInput.value = "laser-raster";
    else ui.toolpathTypeInput.value = "profile-outside";
  }
  // if current operation is now hidden, switch to first visible
  const visibleOps = ui.operationOptions.filter((o) => !o.classList.contains("d-none"));
  if (!visibleOps.some((o) => o.dataset.operation === ui.toolpathTypeInput.value) && visibleOps[0]) {
    ui.toolpathTypeInput.value = visibleOps[0].dataset.operation;
  }
  refreshOperationUiFn(ui);
  refreshToolpathFieldVisibilityFn(ui);
  rebuildDraftToolpath();
}

export function refreshToolpathUi({
  state,
  ui,
  renderableToolpaths,
  activeToolpath,
  tabEligibleToolpathCount,
  onEditToolpath,
  onDeleteToolpath,
  onClearTabs,
  onActivateToolpath,
}) {
  ui.toolpathCount.textContent = String(state.toolpaths.length);
  ui.toolpathList.innerHTML = "";

  for (const toolpath of state.toolpaths) {
    const usesTabs = toolpath.operation === "profile-outside" || toolpath.operation === "profile-inside";
    const card = document.createElement("div");
    card.className = `toolpath-card text-start ${toolpath.id === state.activeToolpathId ? "active" : ""}`;
    card.innerHTML = `
      <div class="row-head">
        <div>
          <h3>${toolpath.label}</h3>
          <div class="meta">${toolpath.cardMeta}</div>
        </div>
        <div class="actions">
          <button type="button" class="action-btn edit" data-action="edit" title="Edit toolpath" aria-label="Edit toolpath">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="action-btn delete" data-action="delete" title="Delete toolpath" aria-label="Delete toolpath">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="meta mt-2">T${toolpath.toolNumber || 1} - Feed ${Math.round(toolpath.feedRate)} - Plunge ${Math.round(toolpath.plungeRate)} - RPM ${Math.round(toolpath.spindle)}</div>
      ${usesTabs ? `
        <div class="toolpath-card-footer">
          <button type="button" class="btn btn-outline-secondary btn-xs" data-action="clear-tabs">Clear Tabs</button>
        </div>
      ` : ""}
    `;
    card.addEventListener("click", (event) => {
      if (window.getSelection()?.toString()) {
        return;
      }
      const action = event.target.closest("[data-action]");
      if (action?.dataset.action === "edit") {
        onEditToolpath(toolpath);
        return;
      }
      if (action?.dataset.action === "delete") {
        onDeleteToolpath(toolpath);
        return;
      }
      if (action?.dataset.action === "clear-tabs") {
        onClearTabs(toolpath);
        return;
      }
      onActivateToolpath(toolpath);
    });
    ui.toolpathList.appendChild(card);
  }

  const hasToolpaths = state.toolpaths.length > 0;
  const hasTabEligibleToolpaths = tabEligibleToolpathCount > 0;
  // A draft for a different operation must not prevent tabbing an already-saved profile.
  const canEnterAddTabsMode = hasTabEligibleToolpaths && !state.editingToolpathId;
  ui.generateGcodeBtn.disabled = !hasToolpaths;
  ui.generateGcodeBtn.title = hasToolpaths ? "Generate GRBL-compatible G-code" : "Add at least 1 toolpath to export";
  ui.addTabsBtn.disabled = !canEnterAddTabsMode;
  ui.addTabsBtn.classList.toggle("btn-primary", state.addTabsMode);
  ui.addTabsBtn.classList.toggle("btn-outline-primary", !state.addTabsMode);
  ui.addTabsBtn.classList.toggle("is-active", state.addTabsMode);
  ui.addTabsBtn.setAttribute("aria-pressed", String(state.addTabsMode));
  ui.addTabsBtn.title = canEnterAddTabsMode
    ? (state.addTabsMode ? "Finish placing tabs" : "Add tabs to an Inside or Outside profile")
    : "Create an Inside or Outside profile toolpath before placing tabs";

  if (state.addTabsMode) {
    ui.tabModeHint.textContent = "Add Tabs mode active. Hover any profile toolpath and click to place a tab.";
  } else if (!activeToolpath) {
    ui.tabModeHint.textContent = "";
  } else if (state.draftToolpath) {
    ui.tabModeHint.textContent = "Draft preview is live on the canvas.";
  } else {
    ui.tabModeHint.textContent = "";
  }
}
