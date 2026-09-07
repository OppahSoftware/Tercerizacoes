const ImportadorPDF = {
            // Expressão matemática exata para achar: Qtde, Largura, Altura, Item, M2
            regexMedidas: /(\d{1,3})\s+(\d{2,5})\s+(\d{2,5})\s+(\d{1,5})\s+(\d+[,.]\d{1,3})/,

            // Função 1: Apenas lê as coordenadas do PDF e transforma em texto
            async extrairTexto(file) {
                return new Promise((resolve, reject) => {
                    const fileReader = new FileReader();
                    fileReader.onload = async function() {
                        try {
                            const typedarray = new Uint8Array(this.result);
                            const pdf = await pdfjsLib.getDocument(typedarray).promise;
                            let lines = [];
                            
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                
                                let rows = [];
                                textContent.items.forEach(item => {
                                    let str = item.str.trim();
                                    if(!str) return; 
                                    
                                    let y = Math.round(item.transform[5]);
                                    let x = Math.round(item.transform[4]);
                                    
                                    let row = rows.find(r => Math.abs(r.y - y) <= 4);
                                    if(row) { row.items.push({x, str}); } 
                                    else { rows.push({y, items: [{x, str}]}); }
                                });
                                
                                rows.sort((a, b) => b.y - a.y);
                                rows.forEach(r => {
                                    r.items.sort((a, b) => a.x - b.x);
                                    lines.push(r.items.map(i => i.str).join(' '));
                                });
                            }
                            resolve(lines);
                        } catch(e) {
                            reject(e);
                        }
                    };
                    fileReader.readAsArrayBuffer(file);
                });
            },

            // Função 2: Aplica a inteligência de extração (Ignora o código, pega a Descrição)
            processar(lines, obraId) {
                let extractedItens = [];
                let currentDesc = "";
                let currentLocalFallback = "";

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].replace(/\|/g, '').trim().replace(/\s+/g, ' '); 
                    
                    if (!line || line.includes("QTDE") || line.includes("LARGURA")) continue;
                    if (line.includes("COR VIDRO") || line.includes("COR ESQUADRIA") || line.includes("COR ACESSÓRIO")) continue;
                    
                    // IGNORA a linha isolada do código (Ex: GOLCB-JC4-01) para não sujar a tabela
                    if (line.match(/^[A-Z0-9-]{5,25}$/) && !line.match(/(JANELA|PORTA|MAXIM-AR|FIXO|VENEZIANA)/i)) {
                        continue; 
                    }

                    let match = line.match(this.regexMedidas);
                    
                    if (match) {
                        let textBefore = line.substring(0, match.index).trim();
                        let textAfter = line.substring(match.index + match[0].length).trim();
                        
                        // Captura o Tipo APENAS se estiver na mesma linha e não for uma palavra grande
                        let tipo = "-"; 
                        if (textBefore && !textBefore.match(/(JANELA|PORTA|MAXIM|FIXO)/i) && textBefore.length <= 10) {
                            tipo = textBefore; 
                        }

                        let qtde = parseInt(match[1]);
                        let larg = match[2];
                        let alt = match[3];
                        let rawId = match[4];
                        let m2Total = parseFloat(match[5].replace(',', '.'));
                        
                        let local = textAfter || currentLocalFallback || "NÃO INFORMADO";
                        local = local.replace(/Este relatório.*/i, '').trim();

                        let finalDesc = currentDesc || "SEM DESCRIÇÃO";
                        let unitM2 = qtde > 0 ? (m2Total / qtde) : m2Total;

                        for (let q = 0; q < qtde; q++) {
                            let finalId = qtde > 1 ? `Item ${rawId}.${q+1}` : `Item ${rawId}`;
                            
                            extractedItens.push({ id: generateId(), obraId: obraId, pid: finalId, tipo: tipo, desc: finalDesc.toUpperCase(), local: local.toUpperCase(), largura: larg, altura: alt, m2: unitM2, etapa: 'Produção', valor: 0, pago: false, data: '', obs: '' });
                            extractedItens.push({ id: generateId(), obraId: obraId, pid: finalId, tipo: tipo, desc: finalDesc.toUpperCase(), local: local.toUpperCase(), largura: larg, altura: alt, m2: unitM2, etapa: 'Instalação', valor: 0, pago: false, data: '', obs: '' });
                        }
                        currentDesc = ""; 
                    } else {
                        if (line.toUpperCase().includes("*LOCAL/AMBIENTE:")) {
                            currentLocalFallback = line.substring(line.toUpperCase().indexOf(":") + 1).trim();
                            continue;
                        }

                        if (line.match(/(JANELA|PORTA|MAXIM-AR|FIXO|VENEZIANA|PORTÃO|QUADRO|ALÇAPÃO)/i)) {
                            let firstWord = line.split(' ')[0];
                            if (firstWord.match(/^[A-Z0-9-]{5,20}$/) && !firstWord.match(/(JANELA|PORTA|MAXIM)/i)) {
                                line = line.substring(firstWord.length).trim();
                            }
                            currentDesc = line;
                        }
                    }
                }
                return extractedItens;
            }
        };
        // ============================================================================
