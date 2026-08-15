type Props = {
  imageUrl?: string | null;
  emptyTitle: string;
  emptyBody: string;
};

export function EventFloorPlanMap({ imageUrl, emptyTitle, emptyBody }: Props) {
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
      </div>
    </div>
  );
}
