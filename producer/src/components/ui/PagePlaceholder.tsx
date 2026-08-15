type Props = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: Props) {
  return (
    <section className="producer-page">
      <header className="producer-page__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="producer-page__placeholder">{description}</div>
    </section>
  );
}
