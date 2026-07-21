const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    authorization: "Basic ---",
  },
};

fetch("https://api.alegra.com/api/v1/invoices", options)
  .then((res) => res.json())
  .then((res) => console.log(res))
  .catch((err) => console.error(err));
