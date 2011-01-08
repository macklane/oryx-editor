package de.hpi.compatibility;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import nl.tue.tm.is.graph.TwoTransitionSets;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Result {

	private int nrComplexProjectionCorrespondences = 0;
	private int nrSimpleProjectionCompatible = 0;
	private int nrComplexProjectionCompatible = 0;
	private int nrSimpleProjectionIncompatible = 0;
	private int nrComplexProjectionIncompatible = 0;

	private int nrComplexProtocolCorrespondences = 0;
	private int nrSimpleProtocolCompatible = 0;
	private int nrComplexProtocolCompatible = 0;
	private int nrSimpleProtocolIncompatible = 0;
	private int nrComplexProtocolIncompatible = 0;
	
	private Map<JSONObject, Boolean> compatibilityResults = new HashMap<JSONObject, Boolean>();
	private List<TwoTransitionSets> correspondences = null;
	
	public Result(Set<TwoTransitionSets> correspondences) {
		this.correspondences = new ArrayList<TwoTransitionSets>(correspondences);
	}
	
	public void addProjectionCorrespondenceResult(TwoTransitionSets c1, TwoTransitionSets c2, boolean areCompatible) {
		if (areCompatible) {
			if (c1.isComplex() || c2.isComplex())
				nrComplexProjectionCompatible++;
			else
				nrSimpleProjectionCompatible++;
		} else {
			if (c1.isComplex() || c2.isComplex())
				nrComplexProjectionIncompatible++;
			else
				nrSimpleProjectionIncompatible++;
		}
		JSONObject correspondencePair = new JSONObject();
		try {
			correspondencePair.put("c1", c1.toJson());
			correspondencePair.put("c2", c2.toJson());
		} catch (JSONException e) {
			e.printStackTrace();
		}
		compatibilityResults.put(correspondencePair, areCompatible);
	}
	
	public void addProtocolCorrespondenceResult(TwoTransitionSets c1, TwoTransitionSets c2, boolean areCompatible) {
		if (areCompatible) {
			if (c1.isComplex() || c2.isComplex())
				nrComplexProtocolCompatible++;
			else
				nrSimpleProtocolCompatible++;
		} else {
			if (c1.isComplex() || c2.isComplex())
				nrComplexProtocolIncompatible++;
			else
				nrSimpleProtocolIncompatible++;
		}
	}
	
	public void addComplexProjectionCorrespondence() {
		nrComplexProjectionCorrespondences++;
	}
	
	public void addComplexProtocolCorrespondence() {
		nrComplexProtocolCorrespondences++;
	}
	
	@Override
	public String toString() {
		String result = "\nNR CORRESPONDENCES:" + correspondences.size();

		result += "\nPROJECTION COMPLEX CORRESPONDENCES:" + nrComplexProjectionCorrespondences;
		result += "\nPROJECTION SIMPLE COMPATIBLE CORRESPONDENCES:" + nrSimpleProjectionCompatible;
		result += "\nPROJECTION SIMPLE INCOMPATIBLE CORRESPONDENCES:" + nrSimpleProjectionIncompatible;
		result += "\nPROJECTION COMPLEX COMPATIBLE CORRESPONDENCES:" + nrComplexProjectionCompatible;
		result += "\nPROJECTION COMPLEX INCOMPATIBLE CORRESPONDENCES:" + nrComplexProjectionIncompatible;
		result += "\n";
		result += "\nPROTOCOL COMPLEX CORRESPONDENCES:" + nrComplexProtocolCorrespondences;
		result += "\nPROTOCOL SIMPLE COMPATIBLE CORRESPONDENCES:" + nrSimpleProtocolCompatible;
		result += "\nPROTOCOL SIMPLE INCOMPATIBLE CORRESPONDENCES:" + nrSimpleProtocolIncompatible;
		result += "\nPROTOCOL COMPLEX COMPATIBLE CORRESPONDENCES:" + nrComplexProtocolCompatible;
		result += "\nPROTOCOL COMPLEX INCOMPATIBLE CORRESPONDENCES:" + nrComplexProtocolIncompatible;

		for (Map.Entry<JSONObject, Boolean> cr : compatibilityResults.entrySet()) {
			if(!cr.getValue())
				result += "\n" + cr.getKey();
		}

		return result;
	}
	
	public JSONArray toJson() {
		JSONArray incomaptibleCorrespondences = new JSONArray();
		
		for (Map.Entry<JSONObject, Boolean> cr : compatibilityResults.entrySet()) {
			if(!cr.getValue()) {
				incomaptibleCorrespondences.put(cr.getKey());
			}
		}
		return incomaptibleCorrespondences;
	}
}
