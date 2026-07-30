export function refreshOperationUi(ui) {
  for (const option of ui.operationOptions) {
    option.classList.toggle("active", option.dataset.operation === ui.toolpathTypeInput.value);
  }
}

export function refreshToolpathFieldVisibility(ui) {
  const operation = ui.toolpathTypeInput.value;
  const isPocket = operation === "pocket";
  const isVCarve = operation === "vcarve";
  const usesTabs = operation === "profile-outside" || operation === "profile-inside";
  const passDepthGroup = ui.passDepthInput?.closest(".col-6");

  ui.overlapField.classList.toggle("d-none", !isPocket);
  ui.cutterAngleField.classList.toggle("d-none", !isVCarve);
  ui.toolDiameterField.classList.toggle("d-none", isVCarve);
  ui.cutDepthField?.classList.toggle("d-none", isVCarve);
  ui.tabWidthField.classList.toggle("d-none", !usesTabs);
  ui.tabHeightField.classList.toggle("d-none", !usesTabs);
  passDepthGroup?.classList.toggle("d-none", isVCarve);
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
  ui.selectionCount.textContent = String(count);
  ui.selectionHeading.textContent = editing ? "Edit Toolpath" : "Selection";
  ui.selectionEmpty.classList.toggle("d-none", count > 0 || Boolean(editing));
  ui.toolpathForm.classList.toggle("d-none", count === 0 && !editing);
  ui.cancelEditBtn.classList.toggle("d-none", !editing);
  ui.toolpathSubmitBtn.textContent = editing ? "Update Toolpath" : "Create Toolpath";
  ui.toolpathFormMode.textContent = editing
    ? `Editing ${editing.label}. Preview updates live, including tabs, before you apply.`
    : count > 0
      ? `Create a new toolpath from ${count} selected vector${count === 1 ? "" : "s"}.`
      : "";
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
  onActivateToolpath,
}) {
  ui.toolpathCount.textContent = String(state.toolpaths.length);
  ui.toolpathList.innerHTML = "";

  for (const toolpath of renderableToolpaths) {
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
      <div class="meta mt-2">Feed ${Math.round(toolpath.feedRate)} - Plunge ${Math.round(toolpath.plungeRate)} - RPM ${Math.round(toolpath.spindle)}</div>
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
      onActivateToolpath(toolpath);
    });
    ui.toolpathList.appendChild(card);
  }

  const hasToolpaths = state.toolpaths.length > 0;
  const hasTabEligibleToolpaths = tabEligibleToolpathCount > 0;
  const canEnterAddTabsMode = hasTabEligibleToolpaths && !state.editingToolpathId && !state.draftToolpath;
  const activeUsesTabs = activeToolpath
    && (activeToolpath.operation === "profile-outside" || activeToolpath.operation === "profile-inside");
  ui.generateGcodeBtn.disabled = !hasToolpaths;
  ui.addTabsBtn.disabled = !canEnterAddTabsMode;
  ui.removeTabsBtn.disabled = !activeUsesTabs;
  ui.addTabsBtn.classList.toggle("btn-primary", state.addTabsMode);
  ui.addTabsBtn.classList.toggle("btn-outline-primary", !state.addTabsMode);

  if (state.addTabsMode) {
    ui.tabModeHint.textContent = "Add Tabs mode active. Hover any profile toolpath and click to place a tab. Drag existing tabs to move them.";
  } else if (!activeToolpath) {
    ui.tabModeHint.textContent = "";
  } else if (state.draftToolpath) {
    ui.tabModeHint.textContent = "Draft toolpath preview is live. You can place tabs before applying.";
  } else {
    ui.tabModeHint.textContent = "";
  }
}
