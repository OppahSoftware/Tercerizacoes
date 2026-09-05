pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let itensOS = [];
const tabelaCorpo = document.getElementById('tabela-corpo');

async function importarPDF() {
    const fileInput = document.getElementById('pdf-upload');
    if (fileInput.files.length === 0) {
        alert('Selecione o arquivo PDF da Ordem de Serviço.');
        return;
    }

    const file = fileInput.files[0];
    const fileReader = new FileReader();

    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let textoCompleto = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            textoCompleto += textContent.items.map(item => item.str).join(' ') + ' ';
        }

        // Validação básica simulando a OS 461 da Obra Jean Camargo
        if (textoCompleto.includes("461") || textoCompleto.includes("JEAN CAMARGO")) {
            alert("Ordem de Serviço lida com sucesso! Carregando os itens...");
            carregarDadosOS461();
        } else {
            alert("PDF lido, mas os dados não correspondem ao formato esperado.");
        }
    };

    fileReader.readAsArrayBuffer(file);
}

function carregarDadosOS461() {
    // Dados desmembrados conforme conversamos
    itensOS = [
        { id: '1', desc: 'PORTA DE GIRO 01 FOLHA | LINHA 42', etapa: 'Produção', valor: 350 },
        { id: '1', desc: 'PORTA DE GIRO 01 FOLHA | LINHA 42', etapa: 'Instalação', valor: 350 },
        { id: '2.1', desc: 'MAXIM-AR COM 01 MÓDULO | GOLD', etapa: 'Produção', valor: 120 },
        { id: '2.1', desc: 'MAXIM-AR COM 01 MÓDULO | GOLD', etapa: 'Instalação', valor: 200 },
        { id: '2.2', desc: 'MAXIM-AR COM 01 MÓDULO | GOLD', etapa: 'Produção', valor: 120 },
        { id: '2.2', desc: 'MAXIM-AR COM 01 MÓDULO | GOLD', etapa: 'Instalação', valor: 200 }
    ];
    
    atualizarResumo();
    renderizarTabela();
}

function atualizarResumo() {
    const total = itensOS.reduce((acc, item) => acc + item.valor, 0);
    const limite = total * 0.30;
    
    document.getElementById('total-obra').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    document.getElementById('limite-vales').innerText = `R$ ${limite.toFixed(2).replace('.', ',')}`;
}

function renderizarTabela() {
    tabelaCorpo.innerHTML = '';
    itensOS.forEach((item) => {
        const tr = document.createElement('tr');
        const uid = `${item.id}-${item.etapa.toLowerCase()}`.replace('.', '-');
        
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.desc}</td>
            <td><strong>${item.etapa}</strong></td>
            <td>R$ ${item.valor.toFixed(2).replace('.', ',')}</td>
            <td><input type="date" id="data-${uid}" onchange="liberarPagamento('${uid}')"></td>
            <td><button class="btn-pay" id="btn-pay-${uid}" disabled onclick="processarPagamento('${uid}', ${item.valor}, '${item.etapa}')">Pagar</button></td>
            <td><button class="btn-obs" onclick="abrirObs('${uid}')">📝</button></td>
        `;
        tabelaCorpo.appendChild(tr);
    });
}

function liberarPagamento(uid) {
    const dataInput = document.getElementById(`data-${uid}`).value;
    const btnPay = document.getElementById(`btn-pay-${uid}`);
    btnPay.disabled = !dataInput; 
}

function processarPagamento(uid, valor, etapa) {
    alert(`Pagamento de R$ ${valor.toFixed(2)} liberado para a etapa de ${etapa}.`);
    const btn = document.getElementById(`btn-pay-${uid}`);
    btn.innerText = 'Pago ✅';
    btn.disabled = true;
    btn.style.backgroundColor = '#3182ce';
}

function abrirObs(uid) {
    const obs = prompt("Insira a observação para esta etapa:");
    if (obs) console.log(`Observação salva [${uid}]: ${obs}`);
}
