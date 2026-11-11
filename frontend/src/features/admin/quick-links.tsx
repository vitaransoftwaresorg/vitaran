export function ChipRow({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <li
              key={item}
              className="rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900"
            >
              {item}
            </li>
          ))
        ) : (
          <li className="text-xs text-neutral-500">{empty}</li>
        )}
      </ul>
    </div>
  );
}
