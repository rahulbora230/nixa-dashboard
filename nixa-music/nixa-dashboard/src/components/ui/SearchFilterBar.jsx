import { Search } from "lucide-react";

const SearchFilterBar = ({ search, onSearch, children, placeholder = "Search" }) => (
  <section className="management-toolbar">
    <label className="management-search span-2">
      <Search size={16} />
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
    </label>
    {children}
  </section>
);

export default SearchFilterBar;
