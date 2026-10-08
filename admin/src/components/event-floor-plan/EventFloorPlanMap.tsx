type Props = {
  imageUrl?: string | null;
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
};

export function EventFloorPlanMap({
  imageUrl,
  emptyTitle,
  emptyBody,
  emptyActionLabel,
  onEmptyAction,
}: Props) {
  if (imageUrl) {
    return (
      <div className="event-floor-plan__canvas">
        <img src={imageUrl} alt="" className="event-floor-plan__uploaded-image" />
      </div>
    );
  }

  return (
    <div className="event-floor-plan__canvas event-floor-plan__canvas--empty">
      <div className="event-floor-plan__empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyBody}</p>
        {emptyActionLabel && onEmptyAction ? (
          <button
            type="button"
            className="event-workspace__btn event-workspace__btn--primary"
            onClick={onEmptyAction}
          >
            {emptyActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
