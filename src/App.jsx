import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

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

  useEffect(() => {
    async function carregarSessao() {
      const { data } = await supabase.auth.getSession()
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
      carregarDados()
    }
  }, [session])

  async function carregarDados() {
    setMensagem('Carregando jogos...')

    const { data: jogosData, error: jogosError } = await supabase
      .from('jogos')
      .select('*')
      .order('data_hora', { ascending: true })

    if (jogosError) {
      setMensagem(`Erro ao carregar jogos: ${jogosError.message}`)
      return
    }

    const { data: palpitesData, error: palpitesError } = await supabase
      .from('palpites')
      .select(`
        *,
        profiles (
          nome,
          apelido
        )
      `)
      
    if (palpitesError) {
      setMensagem(`Erro ao carregar palpites: ${palpitesError.message}`)
      return
    }

    const { data: rankingData, error: rankingError } = await supabase
  .from('ranking')
  .select('*')
  .order('pontos', { ascending: false })

if (rankingError) {
  setMensagem(`Erro ao carregar ranking: ${rankingError.message}`)
  return
}
    const palpitesPorJogo = {}
    const palpitesLiberadosPorJogo = {}

    palpitesData.forEach((palpite) => {
      if (palpite.user_id === session.user.id) {
        palpitesPorJogo[palpite.jogo_id] = {
          gols_a_palpite: palpite.gols_a_palpite,
          gols_b_palpite: palpite.gols_b_palpite,
        }
      }

      if (!palpitesLiberadosPorJogo[palpite.jogo_id]) {
        palpitesLiberadosPorJogo[palpite.jogo_id] = []
      }

      palpitesLiberadosPorJogo[palpite.jogo_id].push(palpite)
    })
    
    const { data: perfilData, error: perfilError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (perfilError) {
      setMensagem(`Erro ao carregar perfil: ${perfilError.message}`)
      return
}
    setJogos(jogosData)
    setPalpites(palpitesPorJogo)
    setPalpitesPublicos(palpitesLiberadosPorJogo)
    setRanking(rankingData)
    setIsAdmin(perfilData?.is_admin === true)
    setMensagem('')  }

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
      setMensagem('Preencha os dois placares antes de salvar.')
      return
    }

    setCarregando(true)
    setMensagem('Salvando palpite...')

    const { error } = await supabase.from('palpites').upsert(
      {
        user_id: session.user.id,
        jogo_id: jogoId,
        gols_a_palpite: Number(palpite.gols_a_palpite),
        gols_b_palpite: Number(palpite.gols_b_palpite),
        atualizado_em: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,jogo_id',
      }
    )

    if (error) {
      setMensagem(`Erro ao salvar: ${error.message}`)
    } else {
      setMensagem('Palpite salvo com sucesso.')
      await carregarDados()
    }

    setCarregando(false)
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
      novoJogo.fase === '' ||
      novoJogo.data_hora === '' ||
      novoJogo.time_a === '' ||
      novoJogo.time_b === ''
    ) {
      setMensagem('Preencha todos os campos do jogo.')
      return
    }

    setCarregando(true)
    setMensagem('Adicionando jogo...')

    const { error } = await supabase.from('jogos').insert({
      fase: novoJogo.fase,
      data_hora: novoJogo.data_hora,
      time_a: novoJogo.time_a,
      time_b: novoJogo.time_b,
      gols_a_real: null,
      gols_b_real: null,
    })

    if (error) {
      setMensagem(`Erro ao adicionar jogo: ${error.message}`)
    } else {
      setMensagem('Jogo adicionado com sucesso.')

      setNovoJogo({
        fase: '',
        data_hora: '',
        time_a: '',
        time_b: '',
      })

      await carregarDados()
    }

    setCarregando(false)
  }

async function salvarResultado(jogoId, golsAReal, golsBReal) {
  if (golsAReal === '' || golsBReal === '' || golsAReal === null || golsBReal === null) {
    setMensagem('Preencha os dois placares reais antes de salvar.')
    return
  }

  setCarregando(true)
  setMensagem('Salvando resultado...')

  const { error } = await supabase
    .from('jogos')
    .update({
      gols_a_real: Number(golsAReal),
      gols_b_real: Number(golsBReal),
    })
    .eq('id', jogoId)

  if (error) {
    setMensagem(`Erro ao salvar resultado: ${error.message}`)
  } else {
    setMensagem('Resultado salvo com sucesso.')
    await carregarDados()
  }

  setCarregando(false)
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
    } else if (data.session) {
      setMensagem('Cadastro realizado e usuário conectado.')
    } else {
      setMensagem('Cadastro realizado. Confira seu e-mail.')
    }

    setCarregando(false)
  }

  async function entrar(evento) {
    evento.preventDefault()
    setCarregando(true)
    setMensagem('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setMensagem(`Erro ao entrar: ${error.message}`)
    }

    setCarregando(false)
  }

async function sair() {
  await supabase.auth.signOut()
  setJogos([])
  setPalpites({})
  setPalpitesPublicos({})
  setRanking([])
  setResultados({})
  setIsAdmin(false)
  setMensagem('')
}

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

      {jogos.length === 0 && <p>Nenhum jogo cadastrado.</p>}

      {jogos.map((jogo) => {
        const palpite = palpites[jogo.id] || {}
        const jogoComecou = new Date(jogo.data_hora) <= new Date()
        const listaPalpitesPublicos = palpitesPublicos[jogo.id] || []

        return (
          <section key={jogo.id}>     
            <p>

              <strong>
                {jogo.time_a} x {jogo.time_b}
              </strong>
            </p>

            <p>{new Date(jogo.data_hora).toLocaleString('pt-BR')}</p>

            <input
              type="number"
              min="0"
              value={palpite.gols_a_palpite ?? ''}
              disabled={jogoComecou}
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
              disabled={jogoComecou}
              onChange={(evento) =>
                alterarPalpite(
                  jogo.id,
                  'gols_b_palpite',
                  evento.target.value
                )
              }
            />

          {!jogoComecou ? (
            <button
              onClick={() => salvarPalpite(jogo.id)}
              disabled={carregando}
            >
              Salvar palpite
            </button>
          ) : (
            <p>Palpites encerrados.</p>
          )}
          {jogoComecou && (
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

<table>
  <thead>
    <tr>
      <th>Posição</th>
      <th>Participante</th>
      <th>Pontos</th>
    </tr>
  </thead>

  <tbody>
    {ranking.map((item, index) => (
      <tr key={item.user_id}>
        <td>{index + 1}º</td>
        <td>{item.apelido || item.nome}</td>
        <td>{item.pontos}</td>
      </tr>
    ))}
  </tbody>
</table>

{isAdmin && (
  <>
    <hr />


<h2>Admin — Cadastrar jogo</h2>

<form onSubmit={adicionarJogo}>
  <input
    type="text"
    placeholder="Fase"
    value={novoJogo.fase}
    onChange={(evento) => alterarNovoJogo('fase', evento.target.value)}
    required
  />

  <input
    type="datetime-local"
    value={novoJogo.data_hora}
    onChange={(evento) => alterarNovoJogo('data_hora', evento.target.value)}
    required
  />

  <input
    type="text"
    placeholder="Time A"
    value={novoJogo.time_a}
    onChange={(evento) => alterarNovoJogo('time_a', evento.target.value)}
    required
  />

  <input
    type="text"
    placeholder="Time B"
    value={novoJogo.time_b}
    onChange={(evento) => alterarNovoJogo('time_b', evento.target.value)}
    required
  />

  <button type="submit" disabled={carregando}>
    Adicionar jogo
  </button>
</form>

    <h2>Admin — Atualizar resultados</h2>

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

          <input
            type="number"
            min="0"
            value={resultado.gols_a_real}
            onChange={(evento) =>
              alterarResultado(jogo.id, 'gols_a_real', evento.target.value)
            }
          />

          <span> x </span>

          <input
            type="number"
            min="0"
            value={resultado.gols_b_real}
            onChange={(evento) =>
              alterarResultado(jogo.id, 'gols_b_real', evento.target.value)
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