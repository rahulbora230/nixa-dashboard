const PageHeader = ({ eyebrow, title, description, actions }) => (
  <section className="admin-hero compact-hero">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="hero-actions">{actions}</div>}
  </section>
);

export default PageHeader;
