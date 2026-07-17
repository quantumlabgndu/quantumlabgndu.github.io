/* ═══════════════════════════════════════════════════════════════
   Quantum Lab — Data Layer (memory-backed CMS)
   All site content is managed here so Admin & Public pages
   share a single source of truth.
   ═══════════════════════════════════════════════════════════════ */

const QLab = (() => {
  const STORAGE_KEY = 'qlab_data_v2';
  const ADMIN_KEY   = 'qlab_admin_v1';
  const USER_KEY    = 'qlab_users_v1';
  const SESSION_KEY = 'qlab_session_v1';

  /* ── Default seed data (matches the original site content) ── */
  // /* --- DATA START --- */
  const DEFAULT_DATA = {
    siteTitle: 'Quantum Lab',
    piName: 'Dr. Harpreet Singh',
    piTitle: 'Assistant Professor of Physics',
    university: 'Guru Nanak Dev University, Amritsar',

    heroTagline: 'Exploring the Quantum Frontier',
    heroSubtitle: 'Quantum sensing, computing & simulation, custom instrumentation, and physics education innovation at GNDU.',
    heroChips: ['Quantum Sensing', 'Quantum Computing & Simulation', 'Custom Scientific Instruments', 'Physics Education Innovation'],

    features: [
      {
        id: 'f1',
        icon: 'atom',
        title: 'Quantum Sensing (NV, SiC, Organics)',
        desc: 'Room-temperature quantum sensors using NV centers, Si vacancies in SiC, and triplet states in doped organic crystals for ultra-sensitive magnetometry, thermometry, and pressure sensing.'
      },
      {
        id: 'f2',
        icon: 'cpu',
        title: 'Quantum Computing & Simulation',
        desc: 'Algorithms on IBM Quantum and a simulation-based NMR QIP, with emphasis on nuclear and chemical Hamiltonians for materials and many-body physics.'
      },
      {
        id: 'f3',
        icon: 'tool',
        title: 'Instruments We Build',
        desc: 'We design and fabricate RF chains, FPGA-based control, and precision electronics—rapid iteration to unlock new experiments.'
      },
      {
        id: 'f4',
        icon: 'graduation',
        title: 'Physics Education, Upgraded',
        desc: 'We integrate modern tech and data-rich experiments to deepen understanding and engagement across physics courses.'
      }
    ],

    research: [
      {
        id: 'r1',
        title: 'Quantum Sensing (NV, SiC, Doped Organic Crystals)',
        img: 'pic/quantumsensing.png',
        body: 'We develop room-temperature quantum sensors based on <strong>NV centers in diamond</strong>, <strong>silicon-vacancy centers in SiC</strong>, and <strong>photoexcited triplet states in organic crystals</strong>. Our work combines optical spectroscopy, pulsed ODMR, and spin-dynamics control to achieve highly sensitive and robust measurements of magnetic fields, temperature, and pressure. We study defect physics, initialization and readout pathways, spin-relaxation channels, and perform zero-field ODMR where useful for compact instrumentation and on-chip integration.\n\nApplications include nanoscale magnetic resonance, materials characterization, microscale thermometry, and precision metrology. We also explore <em>in situ</em> patterning and engineering of defects (e.g., vacancy creation in SiC) to control density, homogeneity, and coherence times.'
      },
      {
        id: 'r2',
        title: 'Quantum Computing & Simulation (IBM Quantum, NMR QIP)',
        img: '',
        body: 'We design and analyze quantum algorithms with a focus on <strong>simulation of nuclear and chemical Hamiltonians</strong>, error-aware variational methods, and kernel-based learning. We work both on <strong>IBM Quantum backends</strong> and a <strong>simulation-driven NMR quantum information processor</strong>, benchmarking performance under realistic noise and gate constraints. Current efforts include compiling chemistry-inspired circuits, exploring biased-noise regimes, and co-designing control with device-level error models.'
      },
      {
        id: 'r3',
        title: 'Fault-Tolerant Quantum Error Correction',
        img: '',
        body: 'We study surface and color codes, threshold behavior, and resource requirements for near-term architectures. We prototype <strong>decoder strategies</strong> tailored to biased noise and time-correlated errors and examine <strong>syndrome extraction</strong> and <strong>lifetime scaling</strong> under realistic control errors. The goal is practical fault-tolerance recipes that map onto devices available today.'
      },
      {
        id: 'r4',
        title: 'Custom Scientific Instrumentation (RF, FPGA, Control Electronics)',
        img: '',
        body: 'We build our own measurement stacks: <strong>RF front-ends</strong>, <strong>low-noise analog chains</strong>, <strong>switching networks</strong>, and <strong>FPGA-based timing/control</strong> for multi-channel pulse generation and synchronized readout. Fast iteration lets us push new pulse sequences, duty cycles, and phase-cycling schemes into experiments quickly. We also design compact ODMR heads and modular optics for rapid reconfiguration.'
      },
      {
        id: 'r5',
        title: 'Physics Education Innovation',
        img: '',
        body: 'We incorporate <strong>modern sensors</strong>, <strong>data acquisition</strong>, and <strong>computation</strong> into undergraduate and graduate teaching labs to deepen conceptual understanding. Projects include portable spectroscopy and magnetometry modules, open-source analysis notebooks, and inquiry-based experiments that bridge fundamental concepts with quantum-era instrumentation.'
      },
      {
        id: 'r6',
        title: 'Grants & Active Initiatives',
        img: '',
        body: '<ul><li><strong>IUAC (New Delhi)</strong>: <em>Creation of Silicon Vacancies in Silicon Carbide for Quantum Sensing Applications</em> (Awarded Jan 2025).</li><li><strong>High-density quantum materials & devices</strong>: functionalized micro-porous structures and bubble-printed nanodiamond platforms for ODMR imaging and sensing.</li><li><strong>Noise-aware simulation</strong>: chemistry and many-body models on IBM Quantum with resource-constrained, bias-aware compilation.</li><li><strong>RF/FPGA platform</strong>: scalable pulsed ODMR/NMR control with open-source tooling and reusable hardware modules.</li></ul>'
      }
    ],

    publications: [
      { id:'p1', year:2025, authors:'<strong>Singh, H.</strong>; D\'Souza, N.; Garrett, J.; Singh, A.; Blankenship, B.; Druga, E.; Montis, R.; Tan, L.; Ajoy, A.', title:'"High sensitivity pressure and temperature quantum sensing in organic crystals."', journal:'<em>Nature Communications</em> (Accepted, 2025). (arXiv:2410.10705v1)', doi:'#', pdf:'#' },
      { id:'p2', year:2025, authors:'Blankenship, B. W.; Rho, Y.; Jones, Z.; Meier, T.; Li, R.; Druga, E.; <strong>Singh, H.</strong>; Xia, X.; Ajoy, A.; Grigoropoulos, C. P.', title:'"Optically Detected Magnetic Resonance Imaging and Sensing Within Functionalized Additively Manufactured Microporous Structures."', journal:'(arXiv:2502.16434)', doi:'#', pdf:'#' },
      { id:'p3', year:2025, authors:'<strong>Singh, H.</strong>; D\'Souza, N.; Zhong, K.; Druga, E.; Oshiro, J.; Blankenship, B.; Reimer, J. A.; Breeze, J. D.; Ajoy, A.', title:'"Room-temperature quantum sensing with photoexcited triplet electrons in organic crystals."', journal:'<em>Physical Review Research</em>, <strong>7</strong>, 013192 (2025).', doi:'#', pdf:'#' },
      { id:'p4', year:2024, authors:'Blankenship, B.; Li, J.; Jones, Z.; Parashar, M.; Zhao, N.; <strong>Singh, H.</strong>; Li, R.; Sophia, A.; Sarkar, A.; Yang, R.; Meier, T.; Rho, Y.; Ajoy, A.; Grigoropoulos, C. P.', title:'"Spatially Resolved Quantum Sensing with High-Density Bubble-Printed Nanodiamonds."', journal:'<em>Nano Letters</em>, <strong>24</strong>, 9711–9719 (2024).', doi:'#', pdf:'#' },
      { id:'p5', year:2023, authors:'<strong>Singh, H.</strong>; Anisimov, A. N.; Baranov, P. G.; Suter, D.', title:'"Zero-Field ODMR and Relaxation of Si-Vacancy Centers in 6H-SiC."', journal:'<em>Materials Research Express</em>, <strong>10</strong>, 11 (2023).', doi:'#', pdf:'#' },
      { id:'p6', year:2023, authors:'Blankenship, B. W.; Jones, Z.; Zhao, N.; <strong>Singh, H.</strong>; Sarkar, A.; Li, R.; Suh, E.; Chen, A.; Grigoropoulos, C. P.; Ajoy, A.', title:'"Complex 3-Dimensional Microscale Structures for Quantum Sensing Applications."', journal:'<em>Nano Letters</em>, <strong>23</strong>, 9272–9279 (2023).', doi:'#', pdf:'#' },
      { id:'p7', year:2023, authors:'Kaur, H.; Riya; Singh, A.; <strong>Singh, H.</strong>; Lal, U. R.; Chaitanya, M. V. N. L.', title:'"Molecular recognition of carbonate ion using a novel turn-on fluorescent probe."', journal:'<em>Spectrochimica Acta Part A: Molecular and Biomolecular Spectroscopy</em>, 123270 (2023).', doi:'#', pdf:'#' },
      { id:'p8', year:2023, authors:'<strong>Singh, H.</strong>; Anisimov, A. N.; Baranov, P. G.; Suter, D.', title:'"Identification of different silicon vacancy centers in 6H-SiC."', journal:'(arXiv:2212.10256, 2023).', doi:'#', pdf:'#' },
      { id:'p9', year:2023, authors:'<strong>Singh, H.</strong>; Hollberg, M. A.; Ghezellou, M.; Ul-Hassan, J.; Kaiser, F.; Suter, D.', title:'"Characterization of single shallow silicon-vacancy centers in 4H-SiC."', journal:'<em>Physical Review B</em>, <strong>107</strong>, 134117 (2023).', doi:'#', pdf:'#' },
      { id:'p10', year:2022, authors:'<strong>Singh, H.</strong>; Hollberg, A. M.; Anisimov, A. N.; Baranov, P. G.; Suter, D.', title:'"Multi-photon multi-quantum transitions in the spin-3/2 silicon-vacancy centers of SiC."', journal:'<em>Physical Review Research</em>, <strong>4</strong>, 023022 (2022).', doi:'#', pdf:'#' },
      { id:'p11', year:2022, authors:'Breev, I. D.; Shang, Z.; Poshakinskiy, A. V.; <strong>Singh, H.</strong>; et al.', title:'"Inverted fine structure of a 6H-SiC qubit enabling robust spin-photon interface."', journal:'<em>npj Quantum Information</em>, <strong>8</strong>, 23 (2022).', doi:'#', pdf:'#' },
      { id:'p12', year:2021, authors:'Soltamov, V. A.; Yavkin, B. V.; Anisimov, A. N.; <strong>Singh, H.</strong>; Bundakova, A. P.; Mamin, G. V.; Orlinskii, S. B.; Mokhov, E. N.; Suter, D.; Baranov, P. G.', title:'"Relaxation processes and high-field coherent spin manipulation in color center ensembles in 6H-SiC."', journal:'<em>Physical Review B</em>, <strong>103</strong>, 195201 (2021).', doi:'#', pdf:'#' },
      { id:'p13', year:2021, authors:'<strong>Singh, H.</strong>; Anisimov, A. N.; Baranov, P. G.; Suter, D.', title:'"Optical spin initialization of spin-3/2 silicon vacancy centers in 6H-SiC at room temperature."', journal:'<em>Physical Review B</em>, <strong>103</strong>, 104103 (2021).', doi:'#', pdf:'#' },
      { id:'p14', year:2020, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Using a Lindbladian approach to model decoherence in two coupled nuclear spins via correlated phase-damping and amplitude damping noise channels."', journal:'<em>Pramana – Journal of Physics</em>, <strong>94</strong>, 160 (2020).', doi:'#', pdf:'#' },
      { id:'p15', year:2020, authors:'<strong>Singh, H.</strong>; Anisimov, A. N.; Nagalyuk, S. S.; Mokhov, E. N.; Baranov, P. G.; Suter, D.', title:'"Experimental characterization of spin 3/2 silicon-vacancy centers in 6H-SiC."', journal:'<em>Physical Review B</em>, <strong>101</strong>, 134110 (2020).', doi:'#', pdf:'#' },
      { id:'p16', year:2018, authors:'Singh, A.; <strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Experimental classification of tripartite entanglement without prior information on an NMR quantum information processor."', journal:'<em>Physical Review A</em>, <strong>98</strong>, 032301 (2018).', doi:'#', pdf:'#' },
      { id:'p17', year:2018, authors:'Devra, A.; Prabhu, P.; <strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Efficient experimental design of high-fidelity three-qubit quantum gates via genetic programming."', journal:'<em>Quantum Information Processing</em>, <strong>17</strong>, 67 (2018).', doi:'#', pdf:'#' },
      { id:'p18', year:2018, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Evolution of tripartite entangled states in a decohering environment and their experimental protection using dynamical decoupling."', journal:'<em>Physical Review A</em>, <strong>97</strong>, 022302 (2018).', doi:'#', pdf:'#' },
      { id:'p19', year:2017, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Experimentally freezing quantum discord in a dissipative environment using dynamical decoupling."', journal:'<em>EPL</em>, <strong>118</strong>, 50001 (2017).', doi:'#', pdf:'#' },
      { id:'p20', year:2017, authors:'Sharma, R.; Gogna, N.; <strong>Singh, H.</strong>; Dorai, K.', title:'"Fast profiling of metabolite mixtures using chemometric analysis of a speeded-up 2D heteronuclear correlation NMR experiment."', journal:'<em>RSC Advances</em>, <strong>7</strong>, 29860 (2017).', doi:'#', pdf:'#' },
      { id:'p21', year:2017, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Experimental protection of arbitrary states in a two-qubit subspace by nested Uhrig dynamical decoupling."', journal:'<em>Physical Review A</em>, <strong>95</strong>, 052337 (2017).', doi:'#', pdf:'#' },
      { id:'p22', year:2016, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Constructing valid density matrices on an NMR quantum information processor via maximum likelihood estimation."', journal:'<em>Physics Letters A</em>, <strong>380</strong>, 3051–3056 (2016).', doi:'#', pdf:'#' },
      { id:'p23', year:2014, authors:'<strong>Singh, H.</strong>; Arvind; Dorai, K.', title:'"Experimental protection against evolution of states in a subspace via a super-Zeno scheme on an NMR quantum information processor."', journal:'<em>Physical Review A</em>, <strong>90</strong>, 052329 (2014).', doi:'#', pdf:'#' }
    ],

    members: [
      { id:'m1', name:'Dr. Harpreet Singh', role:'Principal Investigator', title:'Assistant Professor of Physics', bio:'Leads the Quantum Lab at GNDU.', email:'harpreet.phy@gndu.ac.in', img:'pic/harpreets.png', category:'pi' },
      { id:'m2', name:'Sumit Choudhary', role:'Ph.D. Candidate', title:'Ph.D. Scholar', bio:'Quantum sensing and computation.', email:'sumitphy.rsh@gndu.ac.in', img:'pic/sumit.png', category:'phd' },
      { id:'m3', name:'Rajdeep Singh', role:'Ph.D. Candidate', title:'Ph.D. Scholar', bio:'Focus: quantum sensing.', email:'rajbeepphy.rsh@gndu.ac.in', img:'pic/rajdeep.jpg', category:'phd' },
      { id:'m4', name:'Abdul Baqi', role:'MSc (FYIP) Student', title:'Undergraduate', bio:'Interests: quantum physics and physics education.', email:'abdulphy.std@gndu.ac.in', img:'pic/Abdul.jpeg', category:'undergrad' },
      { id:'m5', name:'Akansha', role:'Graduate, 2025', title:'Alumni', bio:'', email:'', img:'pic/akansha.png', category:'alumni' }
    ],

    collaborators: [
      { id:'c1', name:'Prof. Kavita Dorai', affiliation:'IISER Mohali', url:'' },
      { id:'c2', name:'Prof. Arvind', affiliation:'IISER Mohali', url:'' },
      { id:'c3', name:'Dr. Harjit Kaur', affiliation:'Department of Physics, GNDU, Amritsar', url:'' },
      { id:'c4', name:'Dr. Hardeep Kaur', affiliation:'Department of Chemistry, Khalsa College, Amritsar', url:'' },
      { id:'c5', name:'Dr. Tarunpreet Kaur', affiliation:'Khalsa College of Engineering, Amritsar', url:'' }
    ],

    announcements: [
      { id:'a1', date:'2025-01-15', text:'IUAC funding for "Creation of Silicon Vacancies in Silicon Carbide for Quantum Sensing Applications."' },
      { id:'a2', date:'2025-02-01', text:'Welcome to Sumit Choudhary (Ph.D.).' },
      { id:'a3', date:'2025-08-01', text:'Welcome to Rajdeep Singh (Ph.D.).' }
    ],

    contact: {
      address: 'Department of Physics\nGuru Nanak Dev University\nGrand Trunk Road, Off NH 1\nAmritsar, Punjab, 143005\nIndia',
      office: 'Physics Building, Room 310',
      phone: '+91-9815886371',
      email: 'harpreet.phy@gndu.ac.in',
      mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3395.96014280598!2d74.82198081515436!3d31.66224748132371!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39196345a5416395%3A0x3c73335805884358!2sGuru%20Nanak%20Dev%20University!5e0!3m2!1sen!2sin!4v1663842612345!5m2!1sen!2sin',
      prospective: 'We are always looking for motivated and talented students to join our team. Apply via GNDU Physics Department admissions and email your CV + interests.'
    },

    internalResources: [
      { id:'ir1', name:'NV_ODMR_Controller.pdf', url:'manuals/NV_ODMR_Controller.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'2.4 MB' },
      { id:'ir2', name:'FPGA_Pulse_Generator.pdf', url:'manuals/FPGA_Pulse_Generator.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'1.8 MB' },
      { id:'ir3', name:'RF_Switch_Matrix.pdf', url:'manuals/RF_Switch_Matrix.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'3.1 MB' },
      { id:'ir4', name:'Compact_ODMR_Head.pdf', url:'manuals/Compact_ODMR_Head.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'1.2 MB' },
      { id:'ir5', name:'Lock_in_Amplifier.pdf', url:'manuals/Lock_in_Amplifier.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'2.0 MB' },
      { id:'ir6', name:'Microwave_Source_Synthesizer.pdf', url:'manuals/Microwave_Source_Synthesizer.pdf', category:'manuals', uploadedBy:'Admin', date:'2025-01-10', size:'1.5 MB' }
    ]
  };

  /* ── Default users for internal login ── */
  const DEFAULT_USERS = [
    { username: 'harpreet', password: 'quantum2025', name: 'Dr. Harpreet Singh', role: 'admin', avatar: 'pic/harpreets.png' },
    { username: 'sumit', password: 'sumit123', name: 'Sumit Choudhary', role: 'member', avatar: 'pic/sumit.png' },
    { username: 'rajdeep', password: 'rajdeep123', name: 'Rajdeep Singh', role: 'member', avatar: 'pic/rajdeep.jpg' },
    { username: 'abdul', password: 'abdul123', name: 'Abdul Baqi', role: 'member', avatar: 'pic/Abdul.jpeg' }
  ];
  // /* --- DATA END --- */

  /* ── CRUD helpers ── */
  let inMemoryData = null;

  function _load() {
    return inMemoryData;
  }

  function _save(data) {
    inMemoryData = data;
  }

  function getData() {
    let data = _load();
    if (!data) {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      _save(data);
    }
    return data;
  }

  function setData(data) {
    _save(data);
  }

  function resetData() {
    const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    _save(data);
    return data;
  }

  /* ── Generic list CRUD ── */
  function addItem(listKey, item) {
    const d = getData();
    if (!d[listKey]) d[listKey] = [];
    item.id = listKey.charAt(0) + Date.now();
    d[listKey].push(item);
    setData(d);
    return item;
  }

  function updateItem(listKey, id, updates) {
    const d = getData();
    const arr = d[listKey] || [];
    const idx = arr.findIndex(i => i.id === id);
    if (idx >= 0) { Object.assign(arr[idx], updates); setData(d); return arr[idx]; }
    return null;
  }

  function deleteItem(listKey, id) {
    const d = getData();
    d[listKey] = (d[listKey] || []).filter(i => i.id !== id);
    setData(d);
  }

  /* ── Admin auth ── */
  function getAdminCredentials() {
    return { username: 'admin', password: 'quantumlab2025' };
  }

  function isAdminLoggedIn() {
    return sessionStorage.getItem(ADMIN_KEY) === '1';
  }

  function adminLogin(user, pass) {
    const c = getAdminCredentials();
    if (user === c.username && pass === c.password) {
      sessionStorage.setItem(ADMIN_KEY, '1');
      return true;
    }
    return false;
  }

  function adminLogout() {
    sessionStorage.removeItem(ADMIN_KEY);
  }

  /* ── Member / Internal auth ── */
  let inMemoryUsers = null;

  function getUsers() {
    if (!inMemoryUsers) {
      inMemoryUsers = JSON.parse(JSON.stringify(DEFAULT_USERS));
    }
    return inMemoryUsers;
  }

  function saveUsers(users) {
    inMemoryUsers = users;
  }

  function initUsers() {
    getUsers();
  }

  function memberLogin(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username, name: user.name, role: user.role, avatar: user.avatar }));
      return user;
    }
    return null;
  }

  function getMemberSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function memberLogout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ── Unique ID ── */
  function uid() { return '_' + Math.random().toString(36).substr(2, 9); }

  /* ── Public API ── */
  return {
    getData, setData, resetData,
    addItem, updateItem, deleteItem,
    adminLogin, adminLogout, isAdminLoggedIn,
    getUsers, saveUsers, initUsers,
    memberLogin, memberLogout, getMemberSession,
    uid
  };
})();
