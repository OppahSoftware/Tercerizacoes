 // ============================================================================
        // MÓDULO SEPARADO: IMPORTADOR DE PDF (TERCEIRIZAÇÕES)
        // ============================================================================
        const ImportadorPDF = {
            // Assinatura Matemática (Ignora letras, busca exatamente 5 blocos numéricos)
            regexMedidas: /(?:^|\s)(\d{1,3})\s+(\d{2,5})\s+(\d{2,5})\s+(\d{1,5})\s+(\d+[,.]\d{1,3})/,

            async extrairTexto(file) {
                return new Promise((resolve, reject) => {
                    const fileReader = new FileReader();
                    fileReader.onload = async function() {
                        try {
                            const typedarray = new Uint8Array(this.result);
                            if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js não carregado");
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
                    fileReader.onerror = () => reject(new Error("Erro na leitura local"));
                    fileReader.readAsArrayBuffer(file);
                });
            },

            processar(lines, obraId) {
                let extractedItens = [];
                let currentDesc = "";

                for (let i = 0; i < lines.length; i++) {
                    // Substitui os pipes '|' da tabela por espaço e limpa
                    let line = lines[i].replace(/\|/g, ' ').replace(/\s+/g, ' ').trim(); 
                    
                    // Ignora cabeçalhos do croqui
                    if (!line || line.includes("QTDE") || line.includes("LARGURA") || line.includes("METRAGEM")) continue;
                    if (line.includes("COR VIDRO") || line.includes("COR ESQUADRIA") || line.includes("COR ACESSÓRIO")) continue;
                    
                    // 1. CAPTURAR A DESCRIÇÃO (Ex: JANELA DE CORRER...)
                    if (line.match(/(JANELA|PORTA|MAXIM|FIXO|VENEZIANA|PORTÃO|QUADRO|ALÇAPÃO)/i)) {
                        // Limpa a descrição se o software tiver colado o código GOLCB na frente dela
                        let palavras = line.split(' ');
                        if (palavras[0].match(/^[A-Z0-9-]{5,20}$/) && !palavras[0].match(/(JANELA|PORTA|MAXIM)/i)) {
                            line = line.substring(palavras[0].length).trim();
                        }
                        currentDesc = line;
                        continue; 
                    }

                    // 2. REGRA DO PRINT: "NÃO USAR O CÓDIGO" (Ignora as linhas só com códigos)
                    if (line.match(/^[A-Z0-9-]{5,25}$/)) {
                        continue;
                    }

                    // 3. PROCURAR A TABELA FÍSICA (Qtde, Larg, Alt, Item, M2)
                    let match = line.match(this.regexMedidas);
                    
                    if (match) {
                        let fullMatchString = match[0];
                        let indexDoMatch = line.indexOf(fullMatchString);
                        
                        // Textos que sobraram na esquerda e na direita dos números
                        let textBefore = line.substring(0, indexDoMatch).trim();
                        let textAfter = line.substring(indexDoMatch + fullMatchString.length).trim();
                        
                        // Tipo (Se tiver algo pequeno antes, ex: JA04, captura. Senão, fica vazio "-")
                        let tipo = "-"; 
                        if (textBefore && textBefore.length <= 15) {
                            tipo = textBefore; 
                        }

                        // Matemática
                        let qtde = parseInt(match[1]);
                        let larg = match[2];
                        let alt = match[3];
                        let rawId = match[4];
                        let m2Total = parseFloat(match[5].replace(',', '.'));
                        
                        // 4. CAPTURAR LOCALIZAÇÃO (Tudo o que sobrou após os números)
                        let local = textAfter || "NÃO INFORMADO";
                        local = local.replace(/Este relatório.*/i, '').trim(); // Remove rodapé se colar junto
                        if(!local) local = "NÃO INFORMADO";

                        let finalDesc = currentDesc || "SEM DESCRIÇÃO";
                        
                        // Preço e Metragem unitária caso existam 2 itens iguais
                        let unitM2 = qtde > 0 ? (m2Total / qtde) : m2Total;

                        // 5. INSERIR NA BASE (Multiplicando peças iguais)
                        for (let q = 0; q < qtde; q++) {
                            let finalId = qtde > 1 ? `Item ${rawId}.${q+1}` : `Item ${rawId}`;
                            
                            // Gerador de ID isolado dentro do módulo para evitar travamento (Crash)
                            let idProd = Math.random().toString(36).substr(2, 9);
                            let idInst = Math.random().toString(36).substr(2, 9);
                            
                            extractedItens.push({ id: idProd, obraId: obraId, pid: finalId, tipo: tipo, desc: finalDesc.toUpperCase(), local: local.toUpperCase(), largura: larg, altura: alt, m2: unitM2, etapa: 'Produção', valor: 0, pago: false, data: '', obs: '' });
                            extractedItens.push({ id: idInst, obraId: obraId, pid: finalId, tipo: tipo, desc: finalDesc.toUpperCase(), local: local.toUpperCase(), largura: larg, altura: alt, m2: unitM2, etapa: 'Instalação', valor: 0, pago: false, data: '', obs: '' });
                        }
                        
                        // Limpa a descrição para não vazar para a próxima peça
                        currentDesc = ""; 
                    }
                }
                return extractedItens;
            }
        };
        // ============================================================================
