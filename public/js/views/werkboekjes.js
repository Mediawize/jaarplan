// aangepaste werkboekjes.js
// server-side PDF call
async function downloadPDF(id){
 const res = await fetch(`/api/werkboekjes/pdf-download/${id}`);
 const blob = await res.blob();
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'werkboekje.pdf';
 a.click();
}
