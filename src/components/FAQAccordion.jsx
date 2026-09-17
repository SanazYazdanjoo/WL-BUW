import { useId, useState } from "react";

function FAQItem({ faq }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <h3>
        <button
          id={`${id}-question`}
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={() => setOpen(!open)}
        >
          {faq.question}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h3>
      <div
        id={`${id}-answer`}
        hidden={!open}
        aria-labelledby={`${id}-question`}
      >
        <p>{faq.answer}</p>
      </div>
    </div>
  );
}

export default function FAQAccordion({ faqs }) {
  return (
    <section className="faq-section">
      <h2>Questions</h2>
      {faqs.map((faq) => (
        <FAQItem key={faq.id} faq={faq} />
      ))}
    </section>
  );
}
