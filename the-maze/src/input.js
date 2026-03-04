const KEY_TO_ACTION = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "U",
  s: "D",
  a: "L",
  d: "R",
  W: "U",
  S: "D",
  A: "L",
  D: "R",
};

export function bindInput({
  onAction,
  onRestart,
  onNext,
  onSkip,
  canInput,
}) {
  function handleKeydown(event) {
    if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      onRestart();
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      onSkip();
      return;
    }
    const action = KEY_TO_ACTION[event.key];
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
