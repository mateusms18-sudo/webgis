# Atlas territorial · COREDE Centro-Sul

WebGIS acadêmico para localização e caracterização de feiras da agricultura familiar e agroecológicas, com uma seção complementar de indicadores municipais. O recorte reúne os 17 municípios do COREDE Centro-Sul. A malha municipal simplificada foi selecionada da API de Malhas do IBGE e está armazenada localmente em `data/municipios_corede_centro_sul.geojson`.

## Executar em Python no VS Code

1. Abra esta pasta no VS Code.
2. No menu **Terminal**, escolha **Novo Terminal**.
3. Execute `python app.py` (no Windows, também pode usar `py app.py`). Use Python 3.10 ou mais recente.
4. Abra no navegador o endereço que aparecer no terminal. O servidor tenta usar a porta 8000 e escolhe outra se ela já estiver ocupada.

O servidor foi escrito com a biblioteca padrão do Python, portanto não exige `pip install`. Se o VS Code pedir, selecione um interpretador Python 3.10+ com **Python: Select Interpreter**. O servidor entrega a interface e disponibiliza a malha e os indicadores locais pelas rotas `/api/municipios`, `/api/indicadores` e `/api/status`. O mapa-base e a biblioteca Leaflet são carregados pela internet. A malha e as tabelas do projeto ficam em `data/`.

Como alternativa, também é possível abrir `index.html` com a extensão **Live Server** do VS Code; nesse modo a interface usa os arquivos estáticos locais.

## Cadastro de feiras

Use **Baixar modelo de cadastro** no painel das feiras. Preencha uma linha por feira, sem alterar os nomes das colunas:

```text
Nome_Feira;Municipio;Endereco_Local;Coord_X_Long;Coord_Y_Lat;Ativa;N_Agricultores;Periodicidade;Dias_Horarios;Produtos_Predominantes;Impacto_Desenvolvimento_Rural;Fonte_Informacao;Nome_Informante;Data_Coleta
```

Use coordenadas em graus decimais (longitude em X e latitude em Y), status `Sim` ou `Não`, e periodicidade `Semanal`, `Quinzenal`, `Mensal` ou `Mais de 1x/semana`. O município precisa corresponder a um dos 17 nomes do recorte. Cada ponto abre uma ficha com os atributos informados; filtros permitem consultar município, situação, periodicidade, nome da feira e produtos. A tabela sob o mapa abre o ponto correspondente quando selecionada.

O cadastro é carregado no navegador para a sessão atual; o projeto não envia o arquivo a um servidor nem o grava automaticamente. Insira apenas informações que possam ser divulgadas publicamente, sobretudo no campo de informante. Nenhuma feira ou resposta foi criada como demonstração.

## Indicadores municipais

A seção **Indicadores municipais** abre com os dados oficiais do arquivo `data/indicadores_sidra.csv` e permite filtrar dimensão, indicador, município e ano. A base é uma cópia local obtida pela API de valores do SIDRA em 02/11/2026; ela não se atualiza automaticamente. O modelo de importação adicional fica em `data/modelo_indicadores.csv`.

Na coluna `valor` de CSV importado, use decimal com ponto (por exemplo, `1556.44`) ou o formato brasileiro com ponto de milhar e vírgula decimal (`1.556,44`). Quando **Todos os municípios** está selecionado, contagens e valores monetários são somados; rendas per capita e percentuais não são somados, pois um total regional válido exige os respectivos denominadores para ponderação. Os indicadores monetários fornecidos em mil reais são exibidos em reais (o valor do SIDRA multiplicado por 1.000), evitando confundir a escala da tabela.

Os anos dependem da pesquisa: população, renda e demografia usam 2022; o Censo Agropecuário usa 2017; produção agrícola (PAM) e produção de produtos de origem animal (PPM) usam 2025; e o valor adicionado agropecuário usa 2021, último ano com valores numéricos disponíveis para os 17 municípios consultados na tabela 5938 (2022 e 2023 retornam valores não disponíveis). O valor da PPM se refere aos produtos de origem animal registrados na tabela 74, não ao valor total de todos os rebanhos. As tabelas SIDRA e as unidades aparecem no registro do indicador.

O índice de envelhecimento é calculado como população de 65 anos ou mais dividida pela população de 0 a 14 anos, vezes 100 (tabela 9514). “Moradores até ½ SM per capita ou sem rendimento” soma as faixas até meio salário mínimo e sem rendimento da tabela 10296; é um indicador de baixa renda, não uma taxa oficial de pobreza. A medida de escolaridade soma os grupos “médio completo e superior incompleto” e “superior completo” da tabela 10061 (Censo 2022, resultados da amostra). A taxa de alfabetização da tabela 9543 é outro indicador educacional e vem dos resultados do universo. O indicador de desenvolvimento é o valor adicionado bruto da agropecuária (VAB), não o PIB municipal total.

## Fontes e referências

- Composição do COREDE: [COREDE Centro-Sul, SPGG/RS](https://planejamento.rs.gov.br/upload/arquivos/202408/05154233-centro-sul.pdf).
- Malha municipal: [API de Malhas do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) e [API de Localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades).
- Dados: [SIDRA 9923 (população rural e total)](https://sidra.ibge.gov.br/tabela/9923), [9514 (idade)](https://sidra.ibge.gov.br/tabela/9514), [10295 (rendimento)](https://sidra.ibge.gov.br/tabela/10295), [10296 (classes de rendimento)](https://sidra.ibge.gov.br/tabela/10296), [9543 (alfabetização)](https://sidra.ibge.gov.br/tabela/9543), [10061 (escolaridade)](https://sidra.ibge.gov.br/tabela/10061), [6778 (estabelecimentos familiares)](https://sidra.ibge.gov.br/tabela/6778), [6881 (área)](https://sidra.ibge.gov.br/tabela/6881), [6887 (pessoal ocupado)](https://sidra.ibge.gov.br/tabela/6887), [5457 (PAM)](https://sidra.ibge.gov.br/tabela/5457), [74 (PPM)](https://sidra.ibge.gov.br/tabela/74) e [5938 (PIB municipal/VAB)](https://sidra.ibge.gov.br/tabela/5938).
- Mapa-base: © OpenStreetMap.

## Adicionar ao seu repositório GitHub

Esta pasta é o projeto completo e pode ser copiada para a pasta principal do seu repositório. Mantenha juntos `app.py`, `index.html`, `css/`, `js/`, `data/` e `assets/` para que os caminhos e o servidor funcionem.

No VS Code, abra a pasta do repositório, copie esta pasta para dentro dele e use **Controle do Código-Fonte** para revisar, confirmar (commit) e enviar (push) os arquivos ao GitHub. Se preferir o terminal, na pasta principal do repositório execute:

```bash
git add webgis-feira-agroecologica
git commit -m "Adiciona WebGIS do COREDE Centro-Sul"
git push
```

O repositório armazena o código e os dados; para executar localmente, inicie o servidor Python conforme as instruções acima. O projeto não exige pacotes externos de Python. A biblioteca do mapa e o mapa-base são carregados da internet.
