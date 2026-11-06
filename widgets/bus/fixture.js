// Petit GTFS fictif pour les tests (inspiré de l'arrêt Église de Grands Bois, Alternéo).
export const FILES = {
  'stops.txt': '﻿stop_id,stop_name,location_type\r\n'
    + 'GB1,Eglise De Grands Bois,0\r\n'
    + 'GB2,Eglise De Grands Bois,0\r\n'
    + 'PL,Plage De Grands Bois,0\r\n'
    + 'NP,9 Planètes,0\r\n'
    + 'GSL,Gare Saint Louis,0\r\n'
    + 'ST,"Gare, Saint-Pierre",1\r\n',
  'routes.txt': 'route_id,route_short_name,route_long_name,route_color,route_text_color\n'
    + 'R11,11,9 Planètes - Collège Petite Ile,E30613,FFFFFF\n'
    + 'RLI2,Lit2,Plage De Grands Bois - Gare Saint Louis,0072bc,\n'
    + 'R99,99,Ligne qui ne passe pas ici,,\n',
  'trips.txt': 'route_id,service_id,trip_id,trip_headsign\n'
    + 'R11,SEM,T11A,9 Planètes\n'
    + 'R11,SEM,T11B,\n'
    + 'RLI2,SEM,TL1,Gare Saint Louis\n'
    + 'RLI2,WE,TL2,Gare Saint Louis\n'
    + 'RLI2,SEM,TL3,Plage De Grands Bois\n'
    + 'R99,SEM,T99,Ailleurs\n',
  'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type\n'
    + 'T11A,06:00:00,06:00:00,PL,1,\n'
    + 'T11A,06:05:00,06:05:00,GB1,2,\n'
    + 'T11A,06:30:00,06:30:00,NP,3,\n'
    + 'T11B,07:00:00,07:00:00,NP,1,\n'
    + 'T11B,07:10:00,07:10:00,GB2,2,\n'
    + 'T11B,07:20:00,07:20:00,PL,3,\n'
    + 'TL1,23:50:00,23:50:00,PL,1,\n'
    + 'TL1,24:10:00,24:12:00,GB1,2,\n'
    + 'TL1,24:40:00,24:40:00,GSL,3,\n'
    + 'TL2,09:00:00,09:00:00,PL,1,\n'
    + 'TL2,09:05:00,09:05:00,GB1,2,\n'
    + 'TL2,09:30:00,09:30:00,GSL,3,\n'
    + 'TL3,10:00:00,10:00:00,GSL,1,\n'
    + 'TL3,10:30:00,10:30:00,GB2,2,1\n'
    + 'TL3,10:35:00,10:35:00,PL,3,\n'
    + 'T99,08:00:00,08:00:00,NP,1,\n'
    + 'T99,08:10:00,08:10:00,GSL,2,\n',
  'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n'
    + 'SEM,1,1,1,1,1,0,0,20260824,20270228\n'
    + 'WE,0,0,0,0,0,1,1,20260824,20270228\n',
  'calendar_dates.txt': 'service_id,date,exception_type\n'
    + 'SEM,20261111,2\n'   // 11 novembre (mercredi) : pas de service semaine
    + 'WE,20261111,1\n',   // … mais service week-end
};
