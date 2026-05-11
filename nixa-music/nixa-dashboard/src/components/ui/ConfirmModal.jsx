const ConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  children,
  onConfirm,
  onCancel,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div>
          <p className="eyebrow">Confirm Action</p>
          <h3>{title}</h3>
          {message && <p>{message}</p>}
        </div>
        {children}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`danger-button tone-${tone}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ConfirmModal;
