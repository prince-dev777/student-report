// 1. Nayi file ko import karo (Naam wahi hona chahiye jo file me export kiya hai)
import { QUESTIONS_JEE_MAINS_PHY } from './questions_jee_mains_phy';
import { QUESTIONS_JEE_MAINS_CHEM } from './questions_jee_mains_chem';
import { QUESTIONS_JEE_MAINS_MATH } from './questions_jee_mains_math';
import { QUESTIONS_NEET_PHY } from './questions_neet_phy';
import { QUESTIONS_NEET_CHEM } from './questions_neet_chem';
import { QUESTIONS_NEET_BIO } from './questions_neet_bio';
import { QUESTIONS_JEE_ADV_PHY } from './questions_jee_adv_phy';
import { QUESTIONS_JEE_ADV_CHEM } from './questions_jee_adv_chem';
import { QUESTIONS_JEE_ADV_MATH } from './questions_jee_adv_math';
export const QUESTION_BANK = {
  'jee-mains': {
    phy: QUESTIONS_JEE_MAINS_PHY,
    chem: QUESTIONS_JEE_MAINS_CHEM,
    math: QUESTIONS_JEE_MAINS_MATH
  },
  'jee-adv': {

    phy: QUESTIONS_JEE_ADV_PHY,
    chem: QUESTIONS_JEE_ADV_CHEM,
    math: QUESTIONS_JEE_ADV_MATH
  },
  'neet': {
    phy: QUESTIONS_NEET_PHY,
    chem: QUESTIONS_NEET_CHEM,
    bio: QUESTIONS_NEET_BIO,
  }
};
