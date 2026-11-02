/* APK camera primitives. Evidence: analysis/rea-zjcs/camera-scroll/main-camera-il.txt.
   Group framing solve/damping remains Cinemachine runtime + scene settings; not fabricated here. */
(function(g){'use strict';
 const config=Object.freeze({defaultOrthoConstructor:5,resetDistanceDamping:.3,defaultFollowDamping:Object.freeze({x:.2,y:.2}),zoomFactor:1,editorZoomFactor:.5,viewCloseLimitFactor:.7,viewLeaveLimitFactor:2,viewZoomCloseLimitFactor:2,viewZoomLeaveLimitFactor:.7,gmViewCloseLimitFactor:10,gmViewLeaveLimitFactor:.1,viewOverCloseLimitResetSpeed:0,viewOverLeaveLimitResetSpeed:0,viewBound:Object.freeze({x:8,y:8}),cameraDefTeamInitOffset:Object.freeze({x:0,y:-1,z:0}),defaultMemberRadius:.5,defaultMemberWeight:1,autoGroupFramingMode:2,manualGroupFramingMode:3});
 const settings=()=>config;
 // GameCameraController.GetCharacterRadius 0x060006c5. body offsets in grid units.
 function memberRadius(body=[]){let r=.5;for(const p of body||[])r=Math.max(r,(Math.abs(p.x??p.X??0)+1)/2,(Math.abs(p.y??p.Y??0)+1)/2);return r;}
 // GameCameraController.CanRegisterGroupMember 0x060006c2, IsBelongFilterType 0x060006c0.
 function canRegister(unit,{focus=null,viewBound=null,filterType=0,ourFaction=null,autoRemoveDead=true}={}){if(!unit)return false;if(autoRemoveDead&&(unit.dead||unit.qi<=0)&&unit!==focus&&unit.id!==focus?.id)return false;if(focus&&viewBound&&(Math.abs(focus.x-unit.x)>viewBound.x||Math.abs(focus.y-unit.y)>viewBound.y))return false;if(filterType===1&&unit.faction!==ourFaction)return false;if(filterType===2&&(unit.faction!==ourFaction||!(unit.characterType===1||unit.side==='hero')))return false;return true;}
 // Console.CameraBaseSetting.GetViewSize 0x0600060d. Keep original order, even inverted soft pair.
 function viewSizeLimits(defaultOrtho,{gm=false,framingMaxOrtho=0}={}){let softMin,softMax,zoomMin,zoomMax;if(gm){softMin=zoomMin=defaultOrtho/config.gmViewCloseLimitFactor;softMax=zoomMax=defaultOrtho/config.gmViewLeaveLimitFactor;}else{softMin=defaultOrtho/config.viewCloseLimitFactor;softMax=defaultOrtho/config.viewLeaveLimitFactor;zoomMin=defaultOrtho/config.viewZoomCloseLimitFactor;zoomMax=defaultOrtho/config.viewZoomLeaveLimitFactor;}return{softMin,softMax,zoomMin,zoomMax:Math.max(zoomMax,framingMaxOrtho)};}
 // Mathf.Clamp follows sequential checks, not sorted min/max.
 function clampUnity(v,min,max){if(v<min)v=min;else if(v>max)v=max;return v;}
 function zoomViewSize(current,multiplier,limits){let delta=current*(multiplier-1);if(current<=limits.softMin&&delta<=0)delta*=(current-limits.zoomMin)/(limits.softMin-limits.zoomMin);else if(current>=limits.softMax&&delta>=0)delta*=(limits.zoomMax-current)/(limits.zoomMax-limits.softMax);return clampUnity(current+delta,limits.zoomMin,limits.zoomMax);}
 function resolutionAdapt(baseSize,baseAspect,aspect){return aspect<baseAspect?baseSize*baseAspect/aspect:baseSize;}
 const api=Object.freeze({settings,config,memberRadius,canRegister,viewSizeLimits,clampUnity,zoomViewSize,resolutionAdapt,source:{controller:'Assembly-CSharp.dll GameCameraController 0x02000135',settingsBundle:'9977e7d963ba3df24fba0afe51c2a2a5',groupFitRecovered:false,prefabOrthoRecovered:false}});g.MobileTacticalCameraRules=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
