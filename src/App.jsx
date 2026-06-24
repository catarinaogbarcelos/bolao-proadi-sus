import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const DURACAO_ESTIMADA_JOGO_MS = 2 * 60 * 60 * 1000
const TEMPO_VISIVEL_APOS_FIM_MS = 1 * 60 * 60 * 1000

function App() {
  const [session, setSession] = useState(null)

  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const [jogos, setJogos] = useState([])
  const [palpites, setPalpites] = useState({})
  const [ranking, setRanking] = useState([])
  const [palpitesPublicos, setPalpitesPublicos] = useState({})
  const [resultados, setResultados] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)

  const [novoJogo, setNovoJogo] = useState({
    fase: '',
    data_hora: '',
    time_a: '',
    time_b: '',
  })

  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [agora, setAgora] = useState(new Date())

  useEffect(() => {
    async function carregarSessao() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setMensagem(`Erro ao carregar sessão: ${error.message}`)
        return
      }

      setSession(data.session)
    }

    carregarSessao()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        setSession(novaSessao)
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) {
      carregarDados(session.user.id)
    }
  }, [session])

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(new Date())
    }, 60 * 1000)

    return () => clearInterval(intervalo)
  }, [])

function obterDataValida(dataHora) {
  if (!dataHora) return null

  const texto = String(dataHora)

  const partes = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  )

  if (partes) {
    const ano = Number(partes[1])
    const mes = Number(partes[2]) - 1
    const dia = Number(partes[3])
    const hora = Number(partes[4])
    const minuto = Number(partes[5])
    const segundo = Number(partes[6] || 0)

    return new Date(ano, mes, dia, hora, minuto, segundo)
  }

  const data = new Date(dataHora)

  if (Number.isNaN(data.getTime())) {
    return null
  }

  return data
}

function formatarDataHora(dataHora) {
  const data = obterDataValida(dataHora)

  if (!data) {
    return 'Data inválida'
  }

  return data.toLocaleString('pt-BR')
}   
  

  function jogoJaComecou(jogo) {
    const inicioJogo = obterDataValida(jogo.data_hora)

    if (!inicioJogo) return false

    return inicioJogo <= agora
  }

  function deveMostrarJogo(jogo) {
    const inicioJogo = obterDataValida(jogo.data_hora)

    if (!inicioJogo) {
      return true
    }

    const limiteExibicao = new Date(
      inicioJogo.getTime() +
        DURACAO_ESTIMADA_JOGO_MS +
        TEMPO_VISIVEL_APOS_FIM_MS
    )

    return agora < limiteExibicao
  }

  async function carregarDados(userId = session?.user?.id) {
    if (!userId) return

    setMensagem('Carregando jogos...')

    try {
      const { data: jogosData, error: jogosError } = await supabase
        .from('jogos')
        .select('*')
        .order('data_hora', { ascending: true })

      if (jogosError) {
        setMensagem(`Erro ao carregar jogos: ${jogosError.message}`)
        return
      }

const { data: meusPalpitesData, error: meusPalpitesError } = await supabase
  .from('palpites')
  .select('id, user_id, jogo_id, gols_a_palpite, gols_b_palpite')
  .eq('user_id', userId)

if (meusPalpitesError) {
  setMensagem(`Erro ao carregar seus palpites: ${meusPalpitesError.message}`)
  return
}

const { data: palpitesPublicosData, error: palpitesPublicosError } = await supabase
  .from('palpites')
  .select(`
    id,
    user_id,
    jogo_id,
    gols_a_palpite,
    gols_b_palpite,
    profiles (
      nome,
      apelido
    )
  `)

if (palpitesPublicosError) {
  setMensagem(`Erro ao carregar palpites públicos: ${palpitesPublicosError.message}`)
  return
}

      const { data: perfilData, error: perfilError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()

      if (perfilError) {
        setMensagem(`Erro ao carregar perfil: ${perfilError.message}`)
        return
      }

const palpitesPorJogo = {}
const palpitesLiberadosPorJogo = {}

;(meusPalpitesData || []).forEach((palpite) => {
  palpitesPorJogo[String(palpite.jogo_id)] = {
    gols_a_palpite: palpite.gols_a_palpite,
    gols_b_palpite: palpite.gols_b_palpite,
  }
})

;(palpitesPublicosData || []).forEach((palpite) => {
  const jogoId = String(palpite.jogo_id)

  if (!palpitesLiberadosPorJogo[jogoId]) {
    palpitesLiberadosPorJogo[jogoId] = []
  }

  palpitesLiberadosPorJogo[jogoId].push(palpite)
})

      setJogos(jogosData || [])
      setPalpites(palpitesPorJogo)
      setPalpitesPublicos(palpitesLiberadosPorJogo)
      setRanking(rankingData || [])
      setIsAdmin(perfilData?.is_admin === true)
      setMensagem('')
    } catch (erro) {
      console.error('Erro inesperado ao carregar dados:', erro)
      setMensagem(`Erro inesperado ao carregar dados: ${erro.message}`)
    }
  }

  function alterarPalpite(jogoId, campo, valor) {
    setPalpites((anteriores) => ({
      ...anteriores,
      [jogoId]: {
        ...anteriores[jogoId],
        [campo]: valor,
      },
    }))
  }

async function salvarPalpite(jogoId) {
  const palpite = palpites[jogoId]

  if (
    palpite?.gols_a_palpite === '' ||
    palpite?.gols_b_palpite === '' ||
    palpite?.gols_a_palpite === undefined ||
    palpite?.gols_b_palpite === undefined
  ) {
    alert('Preencha os dois placares antes de salvar.')
    setMensagem('Preencha os dois placares antes de salvar.')
    return
  }

  setCarregando(true)
  setMensagem('Salvando palpite...')

  try {
    const { data, error } = await supabase
      .from('palpites')
      .upsert(
        {
          user_id: session.user.id,
          jogo_id: jogoId,
          gols_a_palpite: Number(palpite.gols_a_palpite),
          gols_b_palpite: Number(palpite.gols_b_palpite),
        },
        {
          onConflict: 'user_id,jogo_id',
        }
      )
      .select()

    if (error) {
      console.error('Erro ao salvar palpite:', error)
      alert(`Erro ao salvar palpite: ${error.message}`)
      setMensagem(`Erro ao salvar palpite: ${error.message}`)
      return
    }

    console.log('Palpite salvo:', data)

    setPalpites((anteriores) => ({
      ...anteriores,
      [jogoId]: {
        gols_a_palpite: Number(palpite.gols_a_palpite),
        gols_b_palpite: Number(palpite.gols_b_palpite),
      },
    }))

    setMensagem('Palpite salvo com sucesso.')
  } catch (erro) {
    console.error('Erro inesperado ao salvar palpite:', erro)
    alert(`Erro inesperado ao salvar palpite: ${erro.message}`)
    setMensagem(`Erro inesperado ao salvar palpite: ${erro.message}`)
  } finally {
    setCarregando(false)
  }
}

  function alterarNovoJogo(campo, valor) {
    setNovoJogo((anterior) => ({
      ...anterior,
      [campo]: valor,
    }))
  }

  async function adicionarJogo(evento) {
    evento.preventDefault()

    if (
      novoJogo.fase.trim() === '' ||
      novoJogo.data_hora === '' ||
      novoJogo.time_a.trim() === '' ||
      novoJogo.time_b.trim() === ''
    ) {
      setMensagem('Preencha todos os campos do jogo.')
      return
    }

    setCarregando(true)
    setMensagem('Adicionando jogo...')

    try {
      const { error } = await supabase.from('jogos').insert({
        fase: novoJogo.fase.trim(),
        data_hora: novoJogo.data_hora.replace('T', ' '), 
        time_a: novoJogo.time_a.trim(),
        time_b: novoJogo.time_b.trim(),
        gols_a_real: null,
        gols_b_real: null,
      })

      if (error) {
        setMensagem(`Erro ao adicionar jogo: ${error.message}`)
        return
      }

      setMensagem('Jogo adicionado com sucesso.')

      setNovoJogo({
        fase: '',
        data_hora: '',
        time_a: '',
        time_b: '',
      })

      await carregarDados(session.user.id)
    } catch (erro) {
      console.error('Erro inesperado ao adicionar jogo:', erro)
      setMensagem(`Erro inesperado ao adicionar jogo: ${erro.message}`)
    } finally {
      setCarregando(false)
    }
  }

  async function salvarResultado(jogoId, golsAReal, golsBReal) {
    if (
      golsAReal === '' ||
      golsBReal === '' ||
      golsAReal === null ||
      golsBReal === null
    ) {
      setMensagem('Preencha os dois placares reais antes de salvar.')
      return
    }

    setCarregando(true)
    setMensagem('Salvando resultado...')

    try {
      const { error } = await supabase
        .from('jogos')
        .update({
          gols_a_real: Number(golsAReal),
          gols_b_real: Number(golsBReal),
        })
        .eq('id', jogoId)

      if (error) {
        setMensagem(`Erro ao salvar resultado: ${error.message}`)
        return
      }

      setMensagem('Resultado salvo com sucesso.')
      await carregarDados(session.user.id)
    } catch (erro) {
      console.error('Erro inesperado ao salvar resultado:', erro)
      setMensagem(`Erro inesperado ao salvar resultado: ${erro.message}`)
    } finally {
      setCarregando(false)
    }
  }

  function alterarResultado(jogoId, campo, valor) {
    setResultados((anteriores) => ({
      ...anteriores,
      [jogoId]: {
        ...anteriores[jogoId],
        [campo]: valor,
      },
    }))
  }

  async function cadastrar(evento) {
    evento.preventDefault()
    setCarregando(true)
    setMensagem('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            nome,
            apelido,
          },
        },
      })

      if (error) {
        setMensagem(`Erro no cadastro: ${error.message}`)
        return
      }

      if (data.session) {
        setMensagem('Cadastro realizado e usuário conectado.')
      } else {
        setMensagem('Cadastro realizado. Confira seu e-mail.')
      }
    } catch (erro) {
      console.error('Erro inesperado no cadastro:', erro)
      setMensagem(`Erro inesperado no cadastro: ${erro.message}`)
    } finally {
      setCarregando(false)
    }
  }

  async function entrar(evento) {
    evento.preventDefault()
    setCarregando(true)
    setMensagem('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      if (error) {
        setMensagem(`Erro ao entrar: ${error.message}`)
      }
    } catch (erro) {
      console.error('Erro inesperado ao entrar:', erro)
      setMensagem(`Erro inesperado ao entrar: ${erro.message}`)
    } finally {
      setCarregando(false)
    }
  }

  async function sair() {
    await supabase.auth.signOut()

    setSession(null)
    setJogos([])
    setPalpites({})
    setPalpitesPublicos({})
    setRanking([])
    setResultados({})
    setIsAdmin(false)
    setMensagem('')
  }

  function obterZonaRanking(index, totalParticipantes) {
    const posicao = index + 1
    const ehUltimo = posicao === totalParticipantes
    const estaNoRebaixamento = posicao > totalParticipantes - 4

    if (ehUltimo) {
      return {
        texto: '🧠 Prêmio Dinizismo Estatístico / Troféu Eu Acreditei',
        classe: 'zona-dinizismo',
      }
    }

    if (estaNoRebaixamento) {
      return {
        texto: '🔻 Rebaixamento',
        classe: 'zona-rebaixamento',
      }
    }

    if (posicao <= 3) {
      return {
        texto: '🏆 G3',
        classe: 'zona-g3',
      }
    }

    if (posicao >= 4 && posicao <= 6) {
      return {
        texto: '🟦 Pré-Libertadores',
        classe: 'zona-pre-libertadores',
      }
    }

    if (posicao >= 7 && posicao <= 12) {
      return {
        texto: '🟩 Sul-Americana',
        classe: 'zona-sulamericana',
      }
    }

    return {
      texto: 'Meio de tabela',
      classe: 'zona-meio',
    }
  }

  const jogosVisiveis = jogos.filter(deveMostrarJogo)

  if (!session) {
    return (
      <main>
        <img
          src={`${import.meta.env.BASE_URL}images/banner.jpg`}
          alt="Banner do Bolão do Proadi-SUS rumo ao hexa"
          className="hero-banner"
        />

        <h1 className="titulo-acessivel">Bolão do Proadi-SUS</h1>

        <section>
          <h2>Criar conta</h2>

          <form onSubmit={cadastrar}>
            <input
              type="text"
              placeholder="Nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Apelido no ranking"
              value={apelido}
              onChange={(evento) => setApelido(evento.target.value)}
              required
            />

            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              minLength="6"
              required
            />

            <button type="submit" disabled={carregando}>
              Criar conta
            </button>
          </form>
        </section>

        <hr />

        <section>
          <h2>Entrar</h2>

          <form onSubmit={entrar}>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              required
            />

            <button type="submit" disabled={carregando}>
              Entrar
            </button>
          </form>
        </section>

        {mensagem && <p>{mensagem}</p>}
      </main>
    )
  }

  return (
    <main>
      <img
        src={`${import.meta.env.BASE_URL}images/banner.jpg`}
        alt="Banner do Bolão do Proadi-SUS rumo ao hexa"
        className="hero-banner"
      />

      <h1 className="titulo-acessivel">Bolão do Proadi-SUS</h1>

      <p>
        Usuário conectado: <strong>{session.user.email}</strong>
      </p>

      <button onClick={sair}>Sair</button>

      <hr />

      <h2>Jogos e palpites</h2>

      {jogosVisiveis.length === 0 && (
        <p>Nenhum jogo disponível no momento.</p>
      )}

      {jogosVisiveis.map((jogo) => {
        const palpite = palpites[String(jogo.id)] || {}
        const comecou = jogoJaComecou(jogo)
        const listaPalpitesPublicos = palpitesPublicos[String(jogo.id)] || []
        return (
          <section key={jogo.id}>
            <h3 className="jogo-times notranslate" translate="no">
              {(jogo.time_a || "A definir") + " x " + (jogo.time_b || "A definir")}
            </h3>
            <p>{formatarDataHora(jogo.data_hora)}</p>

            <input
              type="number"
              min="0"
              value={palpite.gols_a_palpite ?? ''}
              disabled={comecou}
              onChange={(evento) =>
                alterarPalpite(
                  jogo.id,
                  'gols_a_palpite',
                  evento.target.value
                )
              }
            />

            <span> x </span>

            <input
              type="number"
              min="0"
              value={palpite.gols_b_palpite ?? ''}
              disabled={comecou}
              onChange={(evento) =>
                alterarPalpite(
                  jogo.id,
                  'gols_b_palpite',
                  evento.target.value
                )
              }
            />

            {!comecou ? (
              <button
                onClick={() => salvarPalpite(jogo.id)}
                disabled={carregando}
              >
                Salvar palpite
              </button>
            ) : (
              <p>Palpites encerrados.</p>
            )}

            {comecou && (
              <div>
                <h3>Palpites dos participantes</h3>

                {listaPalpitesPublicos.length === 0 && (
                  <p>Nenhum palpite registrado para este jogo.</p>
                )}

                {listaPalpitesPublicos.map((palpitePublico) => (
                  <p key={palpitePublico.id}>
                    <strong>
                      {palpitePublico.profiles?.apelido ||
                        palpitePublico.profiles?.nome ||
                        'Participante'}
                    </strong>
                    : {palpitePublico.gols_a_palpite} x{' '}
                    {palpitePublico.gols_b_palpite}
                  </p>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <hr />

      <h2>Ranking</h2>

      {ranking.length === 0 && <p>Nenhuma pontuação calculada ainda.</p>}

      {ranking.length > 0 && (
        <table className="tabela-ranking">
          <thead>
            <tr>
              <th>Posição</th>
              <th>Participante</th>
              <th>Zona</th>
              <th>Pontos</th>
              <th>Placar exato</th>
              <th>Pontos no mata-mata</th>
            </tr>
          </thead>

          <tbody>
            {ranking.map((item, index) => {
              const zona = obterZonaRanking(index, ranking.length)

              return (
                <tr key={item.user_id} className={zona.classe}>
                  <td>{index + 1}º</td>
                  <td>{item.apelido || item.nome || 'Participante'}</td>
                  <td>{zona.texto}</td>
                  <td>{item.pontos}</td>
                  <td>{item.placares_exatos}</td>
                  <td>{item.pontos_mata_mata}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <section className="regras-bolao">
        <h2>Regras do Bolão</h2>

        <p>
          Os palpites podem ser criados ou alterados até o horário de início de
          cada partida. Depois que o jogo começa, o palpite fica bloqueado.
        </p>

        <p>
          Antes do início da partida, cada participante vê apenas o próprio
          palpite. Após o início do jogo, os palpites daquela partida ficam
          visíveis para todos.
        </p>

        <h3>Pontuação</h3>

        <table>
          <thead>
            <tr>
              <th>Acerto</th>
              <th>Grupos</th>
              <th>16 avos / Oitavas</th>
              <th>Quartas</th>
              <th>Semis / 3º lugar</th>
              <th>Final</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Placar exato</td>
              <td>10</td>
              <td>15</td>
              <td>20</td>
              <td>25</td>
              <td>30</td>
            </tr>

            <tr>
              <td>Vencedor/empate + saldo</td>
              <td>7</td>
              <td>10</td>
              <td>14</td>
              <td>17</td>
              <td>21</td>
            </tr>

            <tr>
              <td>Apenas vencedor/empate</td>
              <td>5</td>
              <td>7</td>
              <td>10</td>
              <td>12</td>
              <td>15</td>
            </tr>

            <tr>
              <td>Errou vencedor/empate</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>

        <h3>Critérios importantes</h3>

        <ul>
          <li>Jogo sem palpite vale 0 pontos.</li>
          <li>O ranking é atualizado após o lançamento do resultado oficial.</li>
          <li>
            Em jogos de mata-mata, vale o placar até o fim da prorrogação, se
            houver. Disputa de pênaltis não entra no placar.
          </li>
          <li>
            Critérios de desempate: maior número de placares exatos, maior
            pontuação no mata-mata e maior número de acertos de vencedor/empate.
          </li>
          <li>
            Nenhuma regra aqui é fixa, tudo pode ser adaptável. Sou apenas uma
            pobre camponesa com o ChatGPT. Se tiverem mais sugestões, fiquem à
            vontade para falar e vamos arrumando e melhorando no percurso.
          </li>
        </ul>

        <h3>Valor de participação: R$ 30 por pessoa.</h3>

        <h4>
          O valor arrecadado será distribuído entre os três primeiros colocados:
        </h4>

        <ul>
          <li>1º lugar: 60% do total arrecadado</li>
          <li>2º lugar: 30% do total arrecadado</li>
          <li>3º lugar: 10% do total arrecadado</li>
        </ul>
      </section>

      {isAdmin && (
        <>
          <hr />

          <h2>Admin — Cadastrar jogo</h2>

          <form onSubmit={adicionarJogo}>
            <input
              type="text"
              placeholder="Fase"
              value={novoJogo.fase}
              onChange={(evento) =>
                alterarNovoJogo('fase', evento.target.value)
              }
              required
            />

            <input
              type="datetime-local"
              value={novoJogo.data_hora}
              onChange={(evento) =>
                alterarNovoJogo('data_hora', evento.target.value)
              }
              required
            />

            <input
              type="text"
              placeholder="Time A"
              value={novoJogo.time_a}
              onChange={(evento) =>
                alterarNovoJogo('time_a', evento.target.value)
              }
              required
            />

            <input
              type="text"
              placeholder="Time B"
              value={novoJogo.time_b}
              onChange={(evento) =>
                alterarNovoJogo('time_b', evento.target.value)
              }
              required
            />

            <button type="submit" disabled={carregando}>
              Adicionar jogo
            </button>
          </form>

          <h2>Admin — Atualizar resultados</h2>

          {jogos.length === 0 && <p>Nenhum jogo cadastrado.</p>}

          {jogos.map((jogo) => {
            const resultado = resultados[jogo.id] || {
              gols_a_real: jogo.gols_a_real ?? '',
              gols_b_real: jogo.gols_b_real ?? '',
            }

            return (
              <section key={`admin-${jogo.id}`}>
                <p>
                  <strong>
                    {jogo.time_a} x {jogo.time_b}
                  </strong>
                </p>

                <p>{formatarDataHora(jogo.data_hora)}</p>

                <input
                  type="number"
                  min="0"
                  value={resultado.gols_a_real}
                  onChange={(evento) =>
                    alterarResultado(
                      jogo.id,
                      'gols_a_real',
                      evento.target.value
                    )
                  }
                />

                <span> x </span>

                <input
                  type="number"
                  min="0"
                  value={resultado.gols_b_real}
                  onChange={(evento) =>
                    alterarResultado(
                      jogo.id,
                      'gols_b_real',
                      evento.target.value
                    )
                  }
                />

                <button
                  onClick={() =>
                    salvarResultado(
                      jogo.id,
                      resultado.gols_a_real,
                      resultado.gols_b_real
                    )
                  }
                  disabled={carregando}
                >
                  Salvar resultado
                </button>
              </section>
            )
          })}
        </>
      )}

      {mensagem && <p>{mensagem}</p>}
    </main>
  )
}

export default App