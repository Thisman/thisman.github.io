const CODE_TO_ACTION = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  KeyW: "U",
  KeyS: "D",
  KeyA: "L",
  KeyD: "R",
};

export function bindInput({
  onAction,
  onRestart,
  onNext,
  onSkip,
  canInput,
}) {
  function handleKeydown(event) {
    if (event.code === "KeyF") {
      event.preventDefault();
      onRestart();
      return;
    }
    if (event.code === "KeyN") {
      event.preventDefault();
      onSkip();
      return;
    }
    const action = CODE_TO_ACTION[event.code];
    if (!action) {
      return;
    }
    event.preventDefault();
    if (!canInput()) {
      return;
    }
    onAction(action);
  }

  window.addEventListener("keydown", handleKeydown);

  const actionButtons = document.querySelectorAll("[data-action]");
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }
      if (!canInput()) {
        return;
      }
      onAction(action);
    });
  });

  const commandButtons = document.querySelectorAll("[data-command]");
  commandButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (command === "restart") {
        onRestart();
      } else if (command === "next") {
        onNext();
      }
    });
  });

  return () => {
    window.removeEventListener("keydown", handleKeydown);
  };
}
