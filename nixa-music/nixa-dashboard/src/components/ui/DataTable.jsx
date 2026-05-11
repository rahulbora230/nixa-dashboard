import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

const DataTable = ({ columns = [], rows = [], rowKey = "id", loading = false, emptyTitle = "No records found", emptyMessage = "Try adjusting filters or search.", actions }) => {
  if (loading) {
    return <LoadingSkeleton rows={7} />;
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row[rowKey] || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
