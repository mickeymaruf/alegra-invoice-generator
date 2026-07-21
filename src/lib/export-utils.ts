export function mapInvoiceToAlegraExportRow(inv: any, item: any) {
  const dateFormatted = inv.date
    ? new Date(inv.date).toLocaleDateString("en-GB")
    : "";
  const dueDateFormatted = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString("en-GB")
    : dateFormatted;

  const subType = inv.numberTemplate?.subDocumentType || "";
  const typeDisplay = subType ? subType.replace("INVOICE_", "") : "C";

  let statusDisplay = "Pending";
  if (inv.status === "closed") statusDisplay = "Paid";
  if (inv.status === "draft") statusDisplay = "Draft";
  if (inv.status === "void") statusDisplay = "Void";

  const taxObj = item?.tax?.[0] || {};
  const taxName = taxObj.name || "Ninguno";
  const taxPct = Number(taxObj.percentage || 0);
  const qty = Number(item?.quantity || 1);
  const unitPrice = Number(item?.price || 0);
  const discount = Number(item?.discount || 0);
  const subtotal = qty * unitPrice - discount;
  const taxValue = (subtotal * taxPct) / 100;
  const itemTotal = subtotal + taxValue;

  return {
    "STAMP DATE": dateFormatted,
    CODE: inv.numberTemplate?.fullNumber || inv.number || "",
    "INVOICE TYPE": typeDisplay,
    "LEGAL STATUS": inv.legalStatus || "Ninguna",
    STATUS: statusDisplay,
    WAREHOUSE: inv.warehouse?.name || "Principal",
    "BRANCH OFFICE": inv.branchOffice?.name || "",
    "COST CENTER": inv.costCenter?.name || "",
    "CLIENT - NAME": inv.client?.name || "",
    "CLIENT - IDENTIFICATION TYPE":
      inv.client?.identificationObject?.type || "DNI",
    "CLIENT - ID NUMBER": inv.client?.identification || "",
    "CLIENT - ADDRESS": inv.client?.address?.address || "",
    "CLIENT - PHONE": inv.client?.phonePrimary || "",
    "CLIENT - CITY": inv.client?.address?.city || "",
    QUOTE: "",
    TERM: inv.term || "Cash",
    EXPIRATION: dueDateFormatted,
    VENDOR: inv.seller?.name || "",
    "PRICE LISTS": inv.priceList?.name || "",
    NOTES: inv.observations || "",
    "PRODUCT/SEVICES - NAME": item?.name || "Services/Product",
    "PRODUCT/SEVICES - REFERENCE": item?.reference || "",
    "PRODUCT/SEVICES - DESCRIPTION": item?.description || "",
    "PRODUCT/SEVICES - QUANTITY": qty.toFixed(2),
    "PRODUCT/SEVICES - UNIT PRICE": unitPrice.toFixed(2),
    "PRODUCT/SEVICES - DISCOUNT": discount.toFixed(2),
    "PRODUCT/SEVICES - TAX": taxName,
    "PRODUCT/SEVICES - TAX (%)": taxPct.toFixed(2),
    "PRODUCT/SEVICES - TAX (VALUE)": taxValue.toFixed(4),
    "PRODUCT/SEVICES - TOTAL": itemTotal.toFixed(2),
    "SUBTOTAL - PRODUCTS/SERVICES": (inv.total || itemTotal).toFixed(2),
    "TOTAL - INVOICE": (inv.total || itemTotal).toFixed(2),
  };
}
