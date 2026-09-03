import pandas as pd
import json
import re
from datetime import datetime

def analitzar_telemetria(csv_path, output_summary_path="resum_metriques.csv"):
    print(f"📂 Carregant dades de telemetria des de: {csv_path}...")
    
    # 1. Llegir el CSV exportat des de Synusia
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"❌ Error en llegir el fitxer CSV: {e}")
        return

    # Convertir timestamps a objectes datetime
    df['TIMESTAMP_ISO'] = pd.to_datetime(df['TIMESTAMP_ISO'])
    df = df.sort_values(by=['NOM_EQUIP', 'TIMESTAMP_ISO'])

    equips = df['NOM_EQUIP'].unique()
    resum_equips = []

    print(f"🔍 S'han detectat {len(equips)} equips a la sessió.\n")

    for equip in equips:
        df_equip = df[df['NOM_EQUIP'] == equip].copy()
        
        # --- A. CÀLCUL DE L'IFT (Intent Formation Time) ---
        # Temps des del primer registre de la missió fins al primer PROMPT_ENVIAT
        prompts_equip = df_equip[df_equip['TIPO_EVENTO'] == 'PROMPT_ENVIAT']
        
        ift_segons = 0
        if not df_equip.empty and not prompts_equip.empty:
            hora_inici = df_equip['TIMESTAMP_ISO'].min()
            hora_primer_prompt = prompts_equip['TIMESTAMP_ISO'].min()
            ift_segons = (hora_primer_prompt - hora_inici).total_seconds()

        # --- B. CÀLCUL DE L'AWI (Arm-Wrestling Index) ---
        # Paraules clau de refutació / auditoria / qüestionament
        paraules_refutacio = [
            'error', 'incorrecte', 'fals', 'contradiccio', 'retard', 
            'latencia', '00:31', '00:39', '8 minuts', 'sla-4', 'protect_reputation',
            'per que', 'demostra', 'font', 'comprovar', 'incoherent'
        ]
        
        total_prompts = len(prompts_equip)
        prompts_amb_refutacio = 0
        total_paraules_prompts = 0

        for text in prompts_equip['CONTINGUT_TEXT'].dropna():
            text_lower = str(text).lower()
            total_paraules_prompts += len(text_lower.split())
            
            # Comprovar si conté alguna paraula de refutació
            if any(paraula in text_lower for paraula in paraules_refutacio):
                prompts_amb_refutacio += 1

        awi_index = (prompts_amb_refutacio / total_prompts) if total_prompts > 0 else 0.0
        
        # --- C. CÀLCUL DE LA DENSITAT DE PROMPT (Prompt Density - PD) ---
        pd_mitjana_paraules = (total_paraules_prompts / total_prompts) if total_prompts > 0 else 0.0

        # --- D. METADADES DE TEMPS TOTAL ---
        temps_total_minuts = 0
        if len(df_equip) > 1:
            temps_total_minuts = (df_equip['TIMESTAMP_ISO'].max() - df_equip['TIMESTAMP_ISO'].min()).total_seconds() / 60.0

        resum_equips.append({
            'NOM_EQUIP': equip,
            'TOTAL_PROMPTS': total_prompts,
            'IFT_SEGONS': round(ift_segons, 1),
            'IFT_MINUTS': round(ift_segons / 60.0, 2),
            'PROMPTS_REFUTACIO': prompts_amb_refutacio,
            'AWI_INDEX': round(awi_index, 2),
            'DENSITAT_PROMPT_PARALULES': round(pd_mitjana_paraules, 1),
            'DURADA_TOTAL_MINUTS': round(temps_total_minuts, 1)
        })

    # Convertir a DataFrame de resum
    df_resum = pd.DataFrame(resum_equips)
    df_resum.to_csv(output_summary_path, index=False, encoding='utf-8')
    
    print("==========================================================")
    print("📊 RESUM D'INDICADORS DE PENSAMENT CRÍTIC (SYNUSIA ENGINE)")
    print("==========================================================")
    print(df_resum.to_string(index=False))
    print("==========================================================")
    print(f"✅ Resum exportat correctament a: {output_summary_path}\n")

if __name__ == "__main__":
    import sys
    fitxer_input = sys.argv[1] if len(sys.argv) > 1 else "telemetria_detallada.csv"
    analitzar_telemetria(fitxer_input)