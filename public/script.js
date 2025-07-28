fetch('/api/orders')
  .then(res => res.json())
  .then(data => {
    const table = document.createElement('table');
    table.border = "1";
    const header = document.createElement('tr');
    header.innerHTML = "<th>Nama</th><th>Item</th><th>Status</th><th>Aksi</th>";
    table.appendChild(header);

    data.forEach(order => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${order.customer_name}</td>
        <td>${order.item}</td>
        <td>${order.status}</td>
        <td>
          <button onclick="confirmOrder(${order.id})">Konfirmasi</button>
          <button onclick="rejectOrder(${order.id})">Tolak</button>
        </td>
      `;
      table.appendChild(row);
    });

    document.body.appendChild(table);
  })
  .catch(err => {
    console.error('Gagal ambil order:', err);
    document.body.innerHTML += '<p style="color:red;">Gagal load data order!</p>';
  });

function confirmOrder(id) {
  fetch(`/api/orders/${id}/confirm`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error("Gagal update status!");
      location.reload();
    })
    .catch(err => alert(err.message));
}

function rejectOrder(id) {
  fetch(`/api/orders/${id}/reject`, { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error("Gagal update status!");
      location.reload();
    })
    .catch(err => alert(err.message));
}
