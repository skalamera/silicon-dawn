import type { PlayableFactionId } from './defs';

export interface CutsceneBeat {
  speaker: string;
  channelCode: string;
  image: string;
  faction: PlayableFactionId;
  line: string;
  audioUrl?: string;
}

export interface CutsceneScript {
  id: string;
  title: string;
  actionLabel: string;
  beats: CutsceneBeat[];
}

export const BRIEFING_CUTSCENES: Record<string, CutsceneScript> = {
  boot_sequence: {
    id: 'boot_sequence',
    title: 'OP-00 // AUTOWARCOM UPLINK',
    actionLabel: 'Enter Theater',
    beats: [
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'SAT-UPLINK 01 // ENCRYPTED',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Commander, welcome to AUTOWARCOM. The Eurasian Pact has crossed the peninsula ridge under broadband GPS jamming.',
        audioUrl: '/assets/voice/cutscene_boot_sequence_0.mp3',
      },
      {
        speaker: 'DRONE RECON // SECTOR 4',
        channelCode: 'OPTICAL FEED // LIVE',
        image: '/assets/fmv-recon.jpg',
        faction: 'alliance',
        line: 'Your robots run on Server Farm FLOPS and Reactor Megawatts. Lose power, and unshielded AI freezes into Safe Mode.',
        audioUrl: '/assets/voice/cutscene_boot_sequence_1.mp3',
      },
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'DIRECTIVE // PRIORITY ALPHA',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Establish a Tactical Foundry, scan the EM Spectrum, and push them back across the strait. Good hunting, Commander.',
        audioUrl: '/assets/voice/cutscene_boot_sequence_2.mp3',
      },
    ],
  },
  alliance_01: {
    id: 'alliance_01',
    title: 'WA-01 // IRON CURTAIN 2.0',
    actionLabel: 'Deploy Forces',
    beats: [
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'PENTAGON WAR ROOM // LIVE',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Pact Krasukha-Q trucks are blacking out our satellite guidance across the central ridge.',
        audioUrl: '/assets/voice/cutscene_alliance_01_0.mp3',
      },
      {
        speaker: 'DRONE RECON // PENINSULA RIDGE',
        channelCode: 'IRON BEAM TELEMETRY',
        image: '/assets/fmv-recon.jpg',
        faction: 'alliance',
        line: 'Your M1E4 tanks carry Quantum Inertial Navigation and Trophy APS—immune to jamming and incoming rockets.',
        audioUrl: '/assets/voice/cutscene_alliance_01_1.mp3',
      },
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'ORDER OF BATTLE',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Hold the forward Iron Beam battery, keep your Megawatt grid above 100%, and dismantle their forward command.',
        audioUrl: '/assets/voice/cutscene_alliance_01_2.mp3',
      },
    ],
  },
  alliance_02: {
    id: 'alliance_02',
    title: 'WA-02 // ZERO-DAY DAWN',
    actionLabel: 'Launch Infiltration',
    beats: [
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'ARCTIC CRYO-BASIN // TOP SECRET',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Intel located the Pact Dark Factory compute cluster in the Arctic Cryo-Basin. Their assembly lines run 24/7.',
        audioUrl: '/assets/voice/cutscene_alliance_02_0.mp3',
      },
      {
        speaker: 'DRONE RECON // UNIT 8200 INSERTION',
        channelCode: 'CYBER OPS // LIVE',
        image: '/assets/fmv-recon.jpg',
        faction: 'alliance',
        line: 'Send Unit 8200 stealth infiltrators into their Server Farms to plant Zero-Day implants and siphon their FLOPS.',
        audioUrl: '/assets/voice/cutscene_alliance_02_1.mp3',
      },
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'Q-DAY PROTOCOL',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Once your Cryo-Core reaches Q-Day, fire Project Prometheus and turn their own autonomous armor against them.',
        audioUrl: '/assets/voice/cutscene_alliance_02_2.mp3',
      },
    ],
  },
  pact_01: {
    id: 'pact_01',
    title: 'EP-01 // DARK ASSEMBLY',
    actionLabel: 'Activate Dark Factories',
    beats: [
      {
        speaker: 'MARSHAL VIKTOR ORLOV // STAVKA-Q',
        channelCode: 'MOSCOW BUNKER // CHANNEL RED',
        image: '/assets/fmv-recon.jpg',
        faction: 'pact',
        line: 'Comrade Commander, Western precision drones rely on wireless links and fragile cloud telemetry. We rely on steel and cable.',
        audioUrl: '/assets/voice/cutscene_pact_01_0.mp3',
      },
      {
        speaker: 'DRONE RECON // WAFER CORRIDOR',
        channelCode: 'DARK FACTORY FEED',
        image: '/assets/fmv-recon.jpg',
        faction: 'pact',
        line: 'Our Dark Factories stamp out Type-99X tanks 50% faster. Pair them with EW Sappers so fiber-tethered armor ignores every hack.',
        audioUrl: '/assets/voice/cutscene_pact_01_1.mp3',
      },
      {
        speaker: 'MARSHAL VIKTOR ORLOV // STAVKA-Q',
        channelCode: 'DIRECTIVE // CRUSH',
        image: '/assets/fmv-recon.jpg',
        faction: 'pact',
        line: 'Roll across the Wafer Corridor, park in welding formation, and bury their laser batteries under thermobaric fire.',
        audioUrl: '/assets/voice/cutscene_pact_01_2.mp3',
      },
    ],
  },
  pact_02: {
    id: 'pact_02',
    title: 'EP-02 // KESSLER MIDNIGHT',
    actionLabel: 'Arm Orbital EMP',
    beats: [
      {
        speaker: 'MARSHAL VIKTOR ORLOV // STAVKA-Q',
        channelCode: 'MEGACITY SECTOR // RED ALERT',
        image: '/assets/fmv-recon.jpg',
        faction: 'pact',
        line: 'The Alliance sensor web watches every avenue in the Megacity. It is time to turn off the sky.',
        audioUrl: '/assets/voice/cutscene_pact_02_0.mp3',
      },
      {
        speaker: 'MARSHAL VIKTOR ORLOV // STAVKA-Q',
        channelCode: 'KESSLER CASCADE // 65% CHARGED',
        image: '/assets/fmv-recon.jpg',
        faction: 'pact',
        line: 'Capture a Legacy Analog Radar Bunker first—hardwired vacuum tubes survive EMP. Then detonate the Kessler Cascade.',
        audioUrl: '/assets/voice/cutscene_pact_02_1.mp3',
      },
    ],
  },
  axis_01: {
    id: 'axis_01',
    title: 'AX-01 // GHOST TUNNEL',
    actionLabel: 'Initiate Ambush',
    beats: [
      {
        speaker: 'COMMANDER TARIQ // SHADOW NET',
        channelCode: 'SUBTERRANEAN MESH // ENCRYPTED',
        image: '/assets/fmv-recon.jpg',
        faction: 'axis',
        line: 'They spent trillions on laser domes and orbital satellites. We brought shovels, decoys, and commercial VR headsets.',
        audioUrl: '/assets/voice/cutscene_axis_01_0.mp3',
      },
      {
        speaker: 'DRONE RECON // CITY APPROACH',
        channelCode: 'SHAHED-X TELEMETRY',
        image: '/assets/fmv-recon.jpg',
        faction: 'axis',
        line: 'Bait their targeting with holographic Decoy Batteries, tunnel beneath city blocks, and split Shahed-X swarms around their beams.',
        audioUrl: '/assets/voice/cutscene_axis_01_1.mp3',
      },
    ],
  },
  axis_02: {
    id: 'axis_02',
    title: 'AX-02 // STRAIT CLOSURE',
    actionLabel: 'Close the Strait',
    beats: [
      {
        speaker: 'COMMANDER TARIQ // SHADOW NET',
        channelCode: 'COASTAL COMMAND // LIVE',
        image: '/assets/fmv-recon.jpg',
        faction: 'axis',
        line: 'Every global supply tanker and naval fleet must pass through this strait. Today, we shut the chokepoint.',
        audioUrl: '/assets/voice/cutscene_axis_02_0.mp3',
      },
      {
        speaker: 'COMMANDER TARIQ // SHADOW NET',
        channelCode: 'OPERATION CHOKEPOINT',
        image: '/assets/fmv-recon.jpg',
        faction: 'axis',
        line: 'Conceal Pop-Up Silos along the cliffs, flood the channel with explosive FAC boats, and trigger Supply-Chain Collapse.',
        audioUrl: '/assets/voice/cutscene_axis_02_1.mp3',
      },
    ],
  },
};

export function getVictoryCutscene(faction: PlayableFactionId, missionTitle: string): CutsceneScript {
  if (faction === 'pact') {
    return {
      id: 'victory_pact',
      title: `VICTORY // ${missionTitle.toUpperCase()}`,
      actionLabel: 'Continue',
      beats: [
        {
          speaker: 'MARSHAL VIKTOR ORLOV // STAVKA-Q',
          channelCode: 'SPECTRUM DOMINATED',
          image: '/assets/fmv-recon.jpg',
          faction: 'pact',
          line: 'Western satellite links are dark and their compute clusters are smoking rubble. The Eurasian Pact controls the spectrum.',
          audioUrl: '/assets/voice/cutscene_victory_pact_0.mp3',
        },
      ],
    };
  }
  if (faction === 'axis') {
    return {
      id: 'victory_axis',
      title: `VICTORY // ${missionTitle.toUpperCase()}`,
      actionLabel: 'Continue',
      beats: [
        {
          speaker: 'COMMANDER TARIQ // SHADOW NET',
          channelCode: 'CHOKEPOINT SECURED',
          image: '/assets/fmv-recon.jpg',
          faction: 'axis',
          line: 'Their billion-dollar hulls burn in the strait while our tunnels remain untouched. Asymmetric warfare prevails.',
          audioUrl: '/assets/voice/cutscene_victory_axis_0.mp3',
        },
      ],
    };
  }
  return {
    id: 'victory_alliance',
    title: `VICTORY // ${missionTitle.toUpperCase()}`,
    actionLabel: 'Continue',
    beats: [
      {
        speaker: 'GEN. MARCUS VANCE // AUTOWARCOM',
        channelCode: 'THEATER SECURED',
        image: '/assets/fmv-alliance.jpg',
        faction: 'alliance',
        line: 'Outstanding work, Commander. Enemy jamming has collapsed and the Silicon Dawn network is secure.',
        audioUrl: '/assets/voice/cutscene_victory_alliance_0.mp3',
      },
    ],
  };
}
