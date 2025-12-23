import './App.css';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { useEffect, useState } from 'react';
import plusIcon from './assets/add.svg';
import arrowIcon from './assets/arrow.svg';
import spinnerIcon from './assets/spinner.svg';
import appIcon from './assets/scale_assignment.svg';
import { supabase } from './lib/supabase';

function App() {
	const [openModal, setOpenModal] = useState(false);
	const [openDamageModal, setOpenDamageModal] = useState(0); // 0 = closed, >0 = claim_id
	const [openDropdown, setOpenDropdown] = useState(false);
	const [openPoliciesDropdown, setOpenPoliciesDropdown] = useState(false);
	const [users, setUsers] = useState([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
	const [policies, setPolicies] = useState([]);
	const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
	const [selectedPolicy, setSelectedPolicy] = useState(null);
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [isValidated, setIsValidated] = useState(false);
	const [validationStatus, setValidationStatus] = useState(null); // 'success', 'address_issue', 'compliance_conflict'
	const [claims, setClaims] = useState([]);
	const [isLoadingClaims, setIsLoadingClaims] = useState(false);
	const [expandedClaims, setExpandedClaims] = useState({});
	const [damages, setDamages] = useState([]);
	const [sourcesDialogOpen, setSourcesDialogOpen] = useState(false);
	const [selectedDamageSources, setSelectedDamageSources] = useState([]);
	const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
	const [selectedDamageHistory, setSelectedDamageHistory] = useState([]);
	const [damageHistory, setDamageHistory] = useState([]);
	
	const [formData, setFormData] = useState({
		user_id: 0,
		policy_id: 0,
		description: '',
		location: '',
		created_at: ''
	});
	
	const [damageFormData, setDamageFormData] = useState({
		claim_id: 0,
		vehicle_part: '',
		damage_description: '',
		photos: [],
		estimated_amount_in_cents: 0,
		override_amount_in_cents: '',
		override_comment: '',
		sources: []
	});
	
	const [isEvaluatingDamage, setIsEvaluatingDamage] = useState(false);
	const [damageValidated, setDamageValidated] = useState(false);
	const [aiSeverity, setAiSeverity] = useState('');
	const [aiEstimatedCost, setAiEstimatedCost] = useState(0);
	const [aiSources, setAiSources] = useState([]);
	const [hasAcceptedEstimate, setHasAcceptedEstimate] = useState(false);
	const [hasRejectedEstimate, setHasRejectedEstimate] = useState(false);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [editingDamageId, setEditingDamageId] = useState(null);
	const [photoValidationIssues, setPhotoValidationIssues] = useState([]);
	
	// Fetch users from Supabase
	useEffect(() => {
		const fetchUsers = async () => {
			setIsLoadingUsers(true);
			try {
				const { data, error } = await supabase
					.from('users')
					.select('*');
				
				if (error) throw error;
				setUsers(data || []);
			} catch (error) {
				console.error('Error fetching users:', error);
			} finally {
				setIsLoadingUsers(false);
			}
		};
		
		fetchUsers();
	}, []);
	
	// Fetch claims and damages from Supabase
	useEffect(() => {
		const fetchClaims = async () => {
			setIsLoadingClaims(true);
			try {
				// Fetch all data
				const [claimsRes, usersRes, policiesRes, damagesRes, historyRes] = await Promise.all([
					supabase.from('claims').select('*').order('created_at', { ascending: false }),
					supabase.from('users').select('*'),
					supabase.from('policies').select('*'),
					supabase.from('damages').select('*'),
					supabase.from('damage_history').select('*').order('created_at', { ascending: true })
				]);
				
				if (claimsRes.error) throw claimsRes.error;
				if (usersRes.error) throw usersRes.error;
				if (policiesRes.error) throw policiesRes.error;
				if (damagesRes.error) throw damagesRes.error;
				if (historyRes.error) throw historyRes.error;
				
				// Manually join the data
				const enrichedClaims = (claimsRes.data || []).map(claim => ({
					...claim,
					user: usersRes.data?.find(u => u.id === claim.user_id),
					policy: policiesRes.data?.find(p => p.id === claim.policy_id)
				}));
				
				setClaims(enrichedClaims);
				setDamages(damagesRes.data || []);
				setDamageHistory(historyRes.data || []);
				// Expand all claims by default
				const expanded = {};
				enrichedClaims.forEach(claim => {
					expanded[claim.id] = true;
				});
				setExpandedClaims(expanded);
			} catch (error) {
				console.error('Error fetching claims:', error);
			} finally {
				setIsLoadingClaims(false);
			}
		};
		
		fetchClaims();
	}, []);
	
	// Fetch policies when user_id changes
	useEffect(() => {
		if (formData.user_id === 0) {
			setPolicies([]);
			setSelectedPolicy(null);
			return;
		}
		
		const fetchPolicies = async () => {
			setIsLoadingPolicies(true);
			console.log('Fetching policies for user_id:', formData.user_id);
			try {
				const { data, error } = await supabase
					.from('policies')
					.select('*')
					.eq('user_id', formData.user_id);
				
				console.log('Policies response:', { data, error });
				if (error) throw error;
				console.log('Found policies:', data?.length || 0);
				setPolicies(data || []);
			} catch (error) {
				console.error('Error fetching policies:', error);
			} finally {
				setIsLoadingPolicies(false);
			}
		};
		
		fetchPolicies();
	}, [formData.user_id]);
	
	// AI Evaluation effect
	useEffect(() => {
		if (formData.location || formData.description) {
			// Debounce: wait 500ms after user stops typing
			const debounceTimer = setTimeout(() => {
				setIsEvaluating(true);
				setIsValidated(false);
				setValidationStatus(null);
				
				// Evaluation takes 3 seconds
				const evaluationTimer = setTimeout(() => {
					setIsEvaluating(false);
					setIsValidated(true);
					
					// Check for specific cases
					if (formData.location === '1600 Pennsylvania Avenue NW in Washington, DC') {
						setValidationStatus('address_issue');
					} else if (formData.description === 'I was driving drunk and crashed my car with a light post') {
						setValidationStatus('compliance_conflict');
					} else {
						setValidationStatus('success');
					}
				}, 3000);
				
				return () => clearTimeout(evaluationTimer);
			}, 500);
			
			return () => clearTimeout(debounceTimer);
		} else {
			setIsEvaluating(false);
			setIsValidated(false);
			setValidationStatus(null);
		}
	}, [formData.location, formData.description]);
	
	useEffect(() => {
		if (openModal === false) {
			setFormData({
				user_id: 0,
				policy_id: 0,
				description: '',
				location: '',
				created_at: ''
			});
			setSelectedUser(null);
			setSelectedPolicy(null);
			setPolicies([]);
			setIsEvaluating(false);
			setIsValidated(false);
			setValidationStatus(null);
		}
	}, [openModal]);
	
	useEffect(() => {
		if (openDamageModal === 0) {
			setDamageFormData({
				claim_id: 0,
				vehicle_part: '',
				damage_description: '',
				photos: [],
				estimated_amount_in_cents: 0,
				override_amount_in_cents: '',
				override_comment: '',
				sources: []
			});
			setIsEvaluatingDamage(false);
			setDamageValidated(false);
			setAiSeverity('');
			setAiEstimatedCost(0);
			setAiSources([]);
			setHasAcceptedEstimate(false);
			setHasRejectedEstimate(false);
			setEditingDamageId(null);
			setPhotoValidationIssues([]);
		} else {
			setDamageFormData(prev => ({
				...prev,
				claim_id: openDamageModal
			}));
			// Randomly assign severity when modal opens
			const severities = ['Low', 'Moderate', 'Severe', 'Critical'];
			const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
			setAiSeverity(randomSeverity);
			
			// Calculate cost based on severity
			let cost = 0;
			switch(randomSeverity) {
				case 'Low':
					cost = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
					break;
				case 'Moderate':
					cost = Math.floor(Math.random() * (14000 - 9000 + 1)) + 9000;
					break;
				case 'Severe':
					cost = Math.floor(Math.random() * (100000 - 12000 + 1)) + 12000;
					break;
				case 'Critical':
					cost = Math.floor(Math.random() * (500000 - 99000 + 1)) + 99000;
					break;
			}
			setAiEstimatedCost(cost);
			
			// Generate random sources (1-3 items)
			const sourceTypes = ['preexisting_claim', 'merchant_benchmark', 'public_data'];
			const numSources = Math.floor(Math.random() * 3) + 1; // 1-3 sources
			const generatedSources = [];
			
			for (let i = 0; i < numSources; i++) {
				const type = sourceTypes[Math.floor(Math.random() * sourceTypes.length)];
				const source = {
					type,
					similarity_score: (Math.random() * (0.99 - 0.75) + 0.75).toFixed(2)
				};
				
				if (type === 'preexisting_claim') {
					source.claim_id = Math.floor(Math.random() * 10000) + 1000;
				}
				
				generatedSources.push(source);
			}
			
			setAiSources(generatedSources);
		}
	}, [openDamageModal]);
	
	function updateFormData(field, value) {
		setFormData({
			...formData,
			[field]: value
		});
	}
	
	function updateDamageFormData(field, value) {
		setDamageFormData({
			...damageFormData,
			[field]: value
		});
	}
	
	// AI Damage Evaluation effect
	useEffect(() => {
		if (damageFormData.vehicle_part && damageFormData.damage_description && damageFormData.photos.length > 0) {
			setIsEvaluatingDamage(true);
			setDamageValidated(false);
			setHasAcceptedEstimate(false);
			setHasRejectedEstimate(false);
			
			const evaluationTimer = setTimeout(() => {
				setIsEvaluatingDamage(false);
				setDamageValidated(true);
				setDamageFormData(prev => ({
					...prev,
					estimated_amount_in_cents: aiEstimatedCost,
					sources: aiSources
				}));
			}, 2500);
			
			return () => clearTimeout(evaluationTimer);
		} else {
			setIsEvaluatingDamage(false);
			setDamageValidated(false);
			setHasAcceptedEstimate(false);
			setHasRejectedEstimate(false);
		}
	}, [damageFormData.vehicle_part, damageFormData.damage_description, damageFormData.photos.length, aiEstimatedCost]);
	
	// Photo upload handler
	const handlePhotoUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;
		
		// Validate file type
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
		if (!validTypes.includes(file.type)) {
			alert('Please upload only JPG, JPEG, or PNG files');
			return;
		}
		
		setUploadingPhoto(true);
		try {
			const fileExt = file.name.split('.').pop();
			const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
			const filePath = `${fileName}`;
			
			console.log('Uploading file:', fileName, 'to bucket: damage-photos');
			
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('damage-photos')
				.upload(filePath, file);
			
			if (uploadError) {
				console.error('Upload error details:', uploadError);
				alert(`Upload failed: ${uploadError.message}`);
				throw uploadError;
			}
			
			console.log('Upload successful:', uploadData);
			
			const { data: urlData } = supabase.storage
				.from('damage-photos')
				.getPublicUrl(filePath);
			
			console.log('Public URL:', urlData.publicUrl);
			
			const photoUrl = urlData.publicUrl;
			
			// Check for problematic filenames and simulate AI validation
			const originalFileName = file.name.toLowerCase();
			let validationIssue = null;
			
			if (originalFileName === 'low_light.jpg') {
				validationIssue = {
					photoUrl,
					type: 'low_light',
					message: 'The lighting in the image seems too dim, please request a better lighted picture'
				};
			} else if (originalFileName === 'preexisting_damage.jpeg') {
				validationIssue = {
					photoUrl,
					type: 'preexisting_damage',
					message: 'The scratch on the vehicle appears to be before the reported date, please analyze carefully the damage and ask for more evidence'
				};
			} else if (originalFileName === 'wrong_vehicle.jpg') {
				validationIssue = {
					photoUrl,
					type: 'wrong_vehicle',
					message: 'The vehicle in the picture appears to be different than the vehicle registered in the policy'
				};
			}
			
			setDamageFormData(prev => ({
				...prev,
				photos: [...prev.photos, photoUrl]
			}));
			
			if (validationIssue) {
				setPhotoValidationIssues(prev => [...prev, validationIssue]);
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
		} finally {
			setUploadingPhoto(false);
		}
	};
	
	// Format cents to USD
	const formatUSD = (cents) => {
		return `$${(cents / 100).toFixed(2)}`;
	};
	
	// Get severity styling
	const getSeverityStyle = (severity) => {
		switch(severity) {
			case 'Low':
				return { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
			case 'Moderate':
				return { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
			case 'Severe':
				return { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
			case 'Critical':
				return { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
			default:
				return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };
		}
	};
	
	// Get severity icon
	const getSeverityIcon = (severity) => {
		switch(severity) {
			case 'Low':
				return (
					<svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
						<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
					</svg>
				);
			case 'Moderate':
				return (
					<svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
						<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
					</svg>
				);
			case 'Severe':
				return (
					<svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
						<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
					</svg>
				);
			case 'Critical':
				return (
					<svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/>
					</svg>
				);
			default:
				return null;
		}
	};
	
	// Generate source description
	const getSourceDescription = (source) => {
		const score = (parseFloat(source.similarity_score) * 100).toFixed(0);
		switch(source.type) {
			case 'preexisting_claim':
				return `Based on ${score}% similarity to a previous claim (Claim #${source.claim_id}), this damage assessment aligns with historical patterns observed in comparable incidents.`;
			case 'merchant_benchmark':
				return `Industry repair cost data from certified auto body shops shows ${score}% correlation with this type of damage, indicating the estimate falls within standard market pricing.`;
			case 'public_data':
				return `Public insurance databases and repair statistics demonstrate ${score}% consistency with similar damage reports, validating the cost assessment through aggregate industry data.`;
			default:
				return `Data source with ${score}% confidence level supports this damage evaluation.`;
		}
	};
	
	// Import cn utility for conditional classes
	function cn(...classes) {
		return classes.filter(Boolean).join(' ');
	}
	
	// Toggle claim expansion
	const toggleClaim = (claimId) => {
		setExpandedClaims(prev => ({
			...prev,
			[claimId]: !prev[claimId]
		}));
	};
	
	// Open sources dialog
	const openSourcesDialog = (sources) => {
		setSelectedDamageSources(sources);
		setSourcesDialogOpen(true);
	};
	
	// Open timeline dialog
	const openTimelineDialog = (damageId) => {
		const history = damageHistory.filter(h => h.damage_id === damageId);
		setSelectedDamageHistory(history);
		setTimelineDialogOpen(true);
	};
	
	// Open edit damage modal
	const openEditDamageModal = (damage) => {
		setEditingDamageId(damage.id);
		setOpenDamageModal(damage.claim_id);
		setDamageFormData({
			claim_id: damage.claim_id,
			vehicle_part: damage.vehicle_part,
			damage_description: damage.damage_description,
			photos: damage.photos || [],
			estimated_amount_in_cents: damage.estimated_amount_in_cents,
			override_amount_in_cents: damage.override_amount_in_cents || '',
			override_comment: damage.override_comment || '',
			sources: damage.sources || []
		});
		// Set AI values from existing damage
		setAiEstimatedCost(damage.estimated_amount_in_cents);
		setAiSources(damage.sources || []);
		// Determine severity based on cost
		const cost = damage.estimated_amount_in_cents;
		let severity = 'Low';
		if (cost >= 99000) severity = 'Critical';
		else if (cost >= 12000) severity = 'Severe';
		else if (cost >= 9000) severity = 'Moderate';
		setAiSeverity(severity);
		setDamageValidated(true);
		setHasAcceptedEstimate(true);
	};
	
	// Get event icon
	const getEventIcon = (eventType, status) => {
		if (eventType === 'created') {
			return (
				<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
				</svg>
			);
		} else if (status === 'approved') {
			return (
				<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
				</svg>
			);
		} else if (status === 'refused') {
			return (
				<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
				</svg>
			);
		} else if (status === 'resubmitted') {
			return (
				<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
				</svg>
			);
		}
		return null;
	};
	
	// Get event color
	const getEventColor = (eventType, status) => {
		if (eventType === 'created') {
			return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', icon: 'text-gray-600' };
		} else if (status === 'approved') {
			return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', icon: 'text-green-600' };
		} else if (status === 'refused') {
			return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', icon: 'text-red-600' };
		} else if (status === 'resubmitted') {
			return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', icon: 'text-blue-600' };
		}
		return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', icon: 'text-gray-600' };
	};
	
	// Get event title
	const getEventTitle = (eventType, status) => {
		if (eventType === 'created') return 'Damage Created';
		if (status === 'approved') return 'Approved';
		if (status === 'refused') return 'Refused';
		if (status === 'resubmitted') return 'Resubmitted';
		return eventType;
	};
	
	return (
		<div className="min-h-screen min-w-screen bg-[#E3E6E8] text-[#070A0D] flex flex-col justify-start">
			<div className="flex py-4 px-8 justify-between items-center w-full">
				<div className="flex items-center gap-4">
					<img src={appIcon} alt="Scale Assignment Logo" className="h-10 w-auto"/>
					<h1 className="text-4xl font-bold my-4">Claims</h1>
				</div>
				
				{/* Overall Metrics */}
				<div className="flex items-center gap-6">
					{/* Total Claims */}
					<div className="flex flex-col items-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
						<span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Claims</span>
						<span className="text-2xl font-bold text-blue-700">{claims.length}</span>
					</div>
					
					{/* Avg Claim Amount */}
					<div className="flex flex-col items-center px-4 py-2 bg-green-50 rounded-lg border border-green-200">
						<span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Avg Claim Amount</span>
						<span className="text-2xl font-bold text-green-700">
							{claims.length > 0 ? formatUSD(
								claims.reduce((sum, claim) => {
									const claimDamages = damages.filter(d => d.claim_id === claim.id);
									const claimTotal = claimDamages.reduce((s, d) => s + (d.override_amount_in_cents || d.estimated_amount_in_cents || 0), 0);
									return sum + claimTotal;
								}, 0) / claims.length
							) : '$0.00'}
						</span>
					</div>
					
					{/* Damages per Claim */}
					<div className="flex flex-col items-center px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
						<span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Damages per Claim</span>
						<span className="text-2xl font-bold text-purple-700">
							{claims.length > 0 ? (damages.length / claims.length).toFixed(1) : '0.0'}
						</span>
					</div>
					
					{/* Overall Approval Rate */}
					<div className="flex flex-col items-center px-4 py-2 bg-orange-50 rounded-lg border border-orange-200">
						<span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Approval Rate</span>
						<span className="text-2xl font-bold text-orange-700">
							{damages.length > 0 
								? `${((damages.filter(d => d.status === 'approved').length / damages.length) * 100).toFixed(0)}%`
								: '0%'
							}
						</span>
					</div>
				</div>
				
				<Dialog open={openModal} onOpenChange={setOpenModal}>
					<DialogTrigger asChild>
						<Button className="rounded-md bg-blue-600 hover:bg-blue-700 text-white p-2 gap-2 flex justify-between items-center">
							<img src={plusIcon} alt="Plus Icon" className="w-6 h-6" />
							<span className="font-bold">New Claim</span>
						</Button>
					</DialogTrigger>
					<DialogContent className="rounded-md">
						<DialogHeader>
							<DialogTitle>Create New Claim</DialogTitle>
							<DialogDescription>
								Fill out the form below to create a new claim.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<label htmlFor="user_id" className="text-sm font-medium">Policy Holder</label>
								<DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
									<DropdownMenuTrigger asChild>
										<Button 
											className={cn(
												"flex justify-between bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 gap-2 rounded-md p-1",
												isLoadingUsers && "opacity-50 cursor-wait"
											)}
											disabled={isLoadingUsers}
										>
											<span className='ml-3'>{selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : 'Select'}</span>
											<img 
												src={isLoadingUsers ? spinnerIcon : arrowIcon} 
												alt="Select Icon" 
												className={cn(
													"w-6 h-6 mx-2 transition-transform duration-200",
													isLoadingUsers ? "animate-spin" : (openDropdown ? "rotate-180" : "")
												)}
											/>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-[400px]">
										<DropdownMenuLabel>
											{isLoadingUsers ? 'Loading users...' : 'Select Policy Holder'}
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{isLoadingUsers ? (
											<DropdownMenuItem disabled>Loading...</DropdownMenuItem>
										) : users.length === 0 ? (
											<DropdownMenuItem disabled>No users found</DropdownMenuItem>
										) : (
											users.map((user) => (
												<DropdownMenuItem
													key={user.id}
													onClick={() => {
														console.log('Selected user:', user.id);
														setSelectedUser(user);
														setSelectedPolicy(null);
														setFormData({
															...formData,
															user_id: user.id,
															policy_id: 0
														});
													}}
													className="flex flex-col items-start"
												>
													<span>{`${user.first_name} ${user.last_name}`}</span>
													<span className='text-xs text-gray-500'>{user.email}</span>
												</DropdownMenuItem>
											))
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							{selectedUser && (
								<div className="grid gap-2">
									<label htmlFor="policy_id" className="text-sm font-medium">Vehicle</label>
									<DropdownMenu open={openPoliciesDropdown} onOpenChange={setOpenPoliciesDropdown}>
										<DropdownMenuTrigger asChild>
											<Button 
												className={cn(
													"flex justify-between bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 gap-2 rounded-md p-1",
													isLoadingPolicies && "opacity-50 cursor-wait"
												)}
												disabled={isLoadingPolicies}
											>
												<span className='ml-3'>{selectedPolicy ? `${selectedPolicy.make} ${selectedPolicy.model} (${selectedPolicy.year})` : 'Select'}</span>
												<img 
													src={isLoadingPolicies ? spinnerIcon : arrowIcon} 
													alt="Select Icon" 
													className={cn(
														"w-6 h-6 mx-2 transition-transform duration-200",
														isLoadingPolicies ? "animate-spin" : (openPoliciesDropdown ? "rotate-180" : "")
													)}
												/>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent className="w-[400px]">
											<DropdownMenuLabel>
												{isLoadingPolicies ? 'Loading policies...' : 'Select Vehicle'}
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
											{isLoadingPolicies ? (
												<DropdownMenuItem disabled>Loading...</DropdownMenuItem>
											) : policies.length === 0 ? (
												<DropdownMenuItem disabled>No policies found for this user</DropdownMenuItem>
											) : (
												policies.map((policy) => (
													<DropdownMenuItem
														key={policy.id}
														onClick={() => {
															setSelectedPolicy(policy);
															updateFormData('policy_id', policy.id);
														}}
														className="flex flex-col items-start"
													>
														<span>{`${policy.make} ${policy.model} (${policy.year})`}</span>
														<span className='text-xs text-gray-500'>{policy.vin}</span>
													</DropdownMenuItem>
												))
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							)}
							<div className="grid gap-2">
								<label htmlFor="location" className="text-sm font-medium">Location</label>
								<input
									id="location"
									type="text"
									value={formData.location}
									onChange={(e) => updateFormData('location', e.target.value)}
									className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
									placeholder="Enter location"
								/>
							</div>
							<div className="grid gap-2">
								<label htmlFor="description" className="text-sm font-medium">Description</label>
								<textarea
									id="description"
									value={formData.description}
									onChange={(e) => updateFormData('description', e.target.value)}
									className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
									placeholder="Enter description"
								/>
							</div>
							
							{/* AI Evaluation Status */}
							{(isEvaluating || isValidated) && (
								<div className={cn(
									"flex items-start gap-2 p-3 rounded-md border",
									isEvaluating && "bg-blue-50 border-blue-200",
									validationStatus === 'success' && "bg-green-50 border-green-200",
									(validationStatus === 'address_issue' || validationStatus === 'compliance_conflict') && "bg-red-50 border-red-200"
								)}>
									{isEvaluating ? (
										<>
											<img src={spinnerIcon} alt="Loading" className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />
											<span className="text-sm text-blue-700 animate-pulse">Evaluating response...</span>
										</>
									) : validationStatus === 'success' ? (
										<>
											<svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
											<span className="text-sm text-green-700 font-medium">Results validated</span>
										</>
									) : validationStatus === 'address_issue' ? (
										<>
											<svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
											</svg>
											<span className="text-sm text-red-700 font-medium">Issue Identified: This address seems to be referencing the White House, please re-verify the damage location</span>
										</>
									) : validationStatus === 'compliance_conflict' ? (
										<>
											<svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
											</svg>
											<span className="text-sm text-red-700 font-medium">
												Potential Compliance Conflict: The description seems to be describing an illegal activity, please review the regulation on{' '}
												<a href="about:blank" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-800">this source</a>
											</span>
										</>
									) : null}
								</div>
							)}
						</div>
						<div className="flex justify-end gap-2">
							<Button onClick={() => setOpenModal(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 p-3 rounded-lg">
								Cancel
							</Button>
							<Button 
							onClick={async (e) => {
								e.preventDefault();
								try {
									const claimData = {
										user_id: formData.user_id,
										policy_id: formData.policy_id,
										location: formData.location,
										description: formData.description,
										created_at: new Date().toISOString()
									};
									
									const { data, error } = await supabase
										.from('claims')
										.insert([claimData])
										.select();
									
									if (error) throw error;
									console.log('Claim created successfully:', data);								
								// Add new claim to the list
								if (data && data.length > 0) {
									setClaims([data[0], ...claims]);
								// Expand the new claim by default
								setExpandedClaims(prev => ({ ...prev, [data[0].id]: true }));
								}
																	setOpenModal(false);
								} catch (error) {
									console.error('Error creating claim:', error);
									alert('Failed to create claim. Please try again.');
								}
								}} 
							disabled={
								!formData.user_id || 
								!formData.policy_id || 
								!formData.location || 
								!formData.description ||
								validationStatus === 'address_issue' || 
								validationStatus === 'compliance_conflict'
							}
							className={cn(
								"p-3 rounded-lg text-white",
								(!formData.user_id || 
								 !formData.policy_id || 
								 !formData.location || 
								 !formData.description ||
								 validationStatus === 'address_issue' || 
								 validationStatus === 'compliance_conflict')
									? "bg-gray-400 cursor-auto"
									: "bg-blue-600 hover:bg-blue-700"
								)}
							>
								Create Claim
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
			
			{/* Sources Dialog */}
			<Dialog open={sourcesDialogOpen} onOpenChange={setSourcesDialogOpen}>
				<DialogContent className="rounded-md max-w-2xl">
					<DialogHeader>
						<DialogTitle>Data Sources</DialogTitle>
						<DialogDescription>
							AI estimation sources and similarity analysis
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						{selectedDamageSources.map((source, index) => (
							<div key={index} className="p-4 rounded-md border border-gray-200 bg-gray-50">
								<div className="flex items-start gap-3">
									<svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									<div className="flex-1">
										<p className="text-sm text-gray-700 leading-relaxed mb-2">
											{getSourceDescription(source)}
										</p>
										<a 
											href="about:blank" 
											target="_blank" 
											rel="noopener noreferrer" 
											className="text-blue-600 hover:text-blue-800 underline text-sm font-medium inline-flex items-center gap-1"
										>
											View source data
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
											</svg>
										</a>
									</div>
								</div>
							</div>
						))}
					</div>
					<div className="flex justify-end">
						<Button onClick={() => setSourcesDialogOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 p-3 rounded-lg">
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			
			{/* Timeline Dialog */}
			<Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
				<DialogContent className="rounded-md max-w-3xl">
					<DialogHeader>
						<DialogTitle>Damage Timeline</DialogTitle>
						<DialogDescription>
							Complete history of events and status changes for this damage
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 max-h-[60vh] overflow-y-auto">
						<div className="relative">
							{/* Timeline line */}
							<div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
							
							{/* Timeline events */}
							<div className="space-y-6">
								{selectedDamageHistory.map((event, index) => {
									const colors = getEventColor(event.event_type, event.status);
									
									return (
										<div key={index} className="relative flex gap-4">
											{/* Icon */}
											<div className={cn(
												"flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10",
												colors.bg, colors.border, colors.icon
											)}>
												{getEventIcon(event.event_type, event.status)}
											</div>
											
											{/* Content */}
											<div className="flex-1 pb-8">
												<div className={cn("p-4 rounded-lg border", colors.bg, colors.border)}>
													<div className="flex items-start justify-between mb-2">
														<h3 className={cn("font-semibold text-base", colors.text)}>
															{getEventTitle(event.event_type, event.status)}
														</h3>
														<span className="text-xs text-gray-500">
															{new Date(event.created_at).toLocaleString()}
														</span>
													</div>
													
													<p className="text-sm text-gray-600 mb-2">
														By: <span className="font-medium">{event.created_by || 'System'}</span>
													</p>
													
													{event.refusal_reason && (
														<div className="mt-3 pt-3 border-t border-red-200">
															<p className="text-sm font-semibold text-red-700 mb-1">
																Reason: {event.refusal_reason}
															</p>
															{event.refusal_comment && (
																<p className="text-sm text-red-600 italic">
																	"{event.refusal_comment}"
																</p>
															)}
														</div>
													)}
													
													{event.status && (
														<div className="mt-2">
															<span className={cn(
																"inline-block px-2 py-1 rounded text-xs font-medium",
																event.status === 'approved' && "bg-green-200 text-green-800",
																event.status === 'refused' && "bg-red-200 text-red-800",
																event.status === 'pending' && "bg-yellow-200 text-yellow-800"
															)}>
																Status: {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
															</span>
														</div>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>
					<div className="flex justify-end">
						<Button onClick={() => setTimelineDialogOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 p-3 rounded-lg">
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			
			{/* Add Damage Dialog */}
			<Dialog open={openDamageModal > 0} onOpenChange={(isOpen) => setOpenDamageModal(isOpen ? openDamageModal : 0)}>
				<DialogContent className="rounded-md">
					<DialogHeader>
						<DialogTitle>{editingDamageId ? 'Edit Damage' : 'Add Damage'}</DialogTitle>
						<DialogDescription>
							{editingDamageId ? 'Update the damage information below.' : 'Fill out the form below to add damage to this claim.'}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
						<div className="grid gap-2">
							<label htmlFor="vehicle_part" className="text-sm font-medium">Vehicle Part <span className="text-red-500">*</span></label>
							<input
								id="vehicle_part"
								type="text"
								value={damageFormData.vehicle_part}
								onChange={(e) => updateDamageFormData('vehicle_part', e.target.value)}
								className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
								placeholder="e.g., Front Bumper, Driver Side Door"
							/>
						</div>
						
						<div className="grid gap-2">
							<label htmlFor="damage_description" className="text-sm font-medium">Damage Description <span className="text-red-500">*</span></label>
							<textarea
								id="damage_description"
								value={damageFormData.damage_description}
								onChange={(e) => updateDamageFormData('damage_description', e.target.value)}
								className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
								placeholder="Describe the damage in detail"
							/>
						</div>
						
						<div className="grid gap-2">
							<label htmlFor="photos" className="text-sm font-medium">Photos <span className="text-red-500">*</span></label>
							<div className="flex flex-wrap gap-2">
								{damageFormData.photos.map((photoUrl, index) => (
									<div key={index} className="relative w-20 h-20 rounded border border-gray-300">
										<img src={photoUrl} alt={`Damage ${index + 1}`} className="w-full h-full object-cover rounded" />
										<button
											onClick={() => {
												const photoToRemove = damageFormData.photos[index];
														setDamageFormData(prev => ({
													...prev,
													photos: prev.photos.filter((_, i) => i !== index)
												}));
														setPhotoValidationIssues(prev => prev.filter(issue => issue.photoUrl !== photoToRemove));
											}}
											className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
										>
											×
										</button>
									</div>
								))}
								<label className={cn(
									"w-20 h-20 rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50",
									uploadingPhoto && "opacity-50 cursor-wait"
								)}>
									<input
										type="file"
										accept="image/jpeg,image/jpg,image/png"
										onChange={handlePhotoUpload}
										disabled={uploadingPhoto}
										className="hidden"
									/>
									{uploadingPhoto ? (
										<img src={spinnerIcon} alt="Uploading" className="w-6 h-6 animate-spin" />
									) : (
										<img src={plusIcon} alt="Add Photo" className="w-6 h-6" />
									)}
								</label>
							</div>
							<span className="text-xs text-gray-500">Accepted formats: JPG, JPEG, PNG</span>
						</div>
						
						{/* Photo Validation Warnings */}
						{photoValidationIssues.length > 0 && (
							<div className="space-y-2">
								{photoValidationIssues.map((issue, index) => (
									<div key={index} className="flex items-start gap-2 p-4 rounded-md border bg-red-50 border-red-200">
										<svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
										<span className="text-sm text-red-700 font-medium">AI Photo Analysis: {issue.message}</span>
									</div>
								))}
							</div>
						)}
						
						{/* AI Evaluation Status */}
						{(isEvaluatingDamage || damageValidated) && (
							<div className={cn(
								"flex flex-col gap-3 p-4 rounded-md border",
								isEvaluatingDamage && "bg-blue-50 border-blue-200",
								damageValidated && getSeverityStyle(aiSeverity).bg + " " + getSeverityStyle(aiSeverity).border
							)}>
								{isEvaluatingDamage ? (
									<div className="flex items-center gap-2">
										<img src={spinnerIcon} alt="Loading" className="w-5 h-5 animate-spin flex-shrink-0" />
										<span className="text-sm text-blue-700 animate-pulse">Evaluating damage severity and cost...</span>
									</div>
								) : (
									<>
										<div className="flex items-center gap-2">
											<div className={getSeverityStyle(aiSeverity).color}>
												{getSeverityIcon(aiSeverity)}
											</div>
											<span className={cn("text-sm font-semibold", getSeverityStyle(aiSeverity).color)}>
												Severity: {aiSeverity}
											</span>
										</div>
										<div className={cn("text-sm", getSeverityStyle(aiSeverity).color)}>
											<span className="font-medium">AI Estimated Cost: </span>
											<span className="font-bold text-lg">{formatUSD(aiEstimatedCost)}</span>
										</div>
										
										{aiSources.length > 0 && (
											<div className="mt-3 pt-3 border-t border-gray-200">
												<span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Data Sources</span>
												<div className="mt-2 space-y-2">
													{aiSources.map((source, index) => (
														<div key={index} className="text-xs text-gray-600 leading-relaxed">
															<p>{getSourceDescription(source)}</p>
															<a 
																href="about:blank" 
																target="_blank" 
																rel="noopener noreferrer" 
																className="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
															>
																View source data →
															</a>
														</div>
													))}
												</div>
											</div>
										)}
										
										{!hasAcceptedEstimate && !hasRejectedEstimate && (
											<div className="flex gap-2 mt-2">
												<Button
													onClick={() => {
														setHasAcceptedEstimate(true);
														setDamageFormData(prev => ({
															...prev,
															estimated_amount_in_cents: aiEstimatedCost,
															override_amount_in_cents: ''
														}));
													}}
													className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded-md text-sm"
												>
													Accept Estimate
												</Button>
												<Button
													onClick={() => {
														setHasRejectedEstimate(true);
													}}
													className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md text-sm"
												>
													Enter Manual Estimate
												</Button>
											</div>
										)}
										
										{hasAcceptedEstimate && (
											<div className="flex items-center gap-2 mt-2 p-2 bg-green-100 rounded">
												<svg className="w-4 h-4 text-green-700" fill="currentColor" viewBox="0 0 24 24">
													<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
												</svg>
												<span className="text-sm text-green-700 font-medium">Estimate accepted: {formatUSD(aiEstimatedCost)}</span>
											</div>
										)}
									</>
								)}
							</div>
						)}
						
						{hasRejectedEstimate && (
							<>
								<div className="grid gap-2">
									<label htmlFor="override_amount" className="text-sm font-medium">
										Manual Estimate (in cents) <span className="text-red-500">*</span>
										<span className="ml-2 text-xs text-gray-500">AI suggested: {formatUSD(aiEstimatedCost)}</span>
									</label>
									<input
										id="override_amount"
										type="number"
										value={damageFormData.override_amount_in_cents}
										onChange={(e) => updateDamageFormData('override_amount_in_cents', e.target.value)}
										className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
										placeholder="Enter amount in cents (e.g., 50000 for $500.00)"
										min="1"
									/>
									{damageFormData.override_amount_in_cents && (
										<span className="text-sm text-gray-600">
											= {formatUSD(parseInt(damageFormData.override_amount_in_cents) || 0)}
										</span>
									)}
								</div>
								
								<div className="grid gap-2">
									<label htmlFor="override_comment" className="text-sm font-medium">Override Comment <span className="text-red-500">*</span></label>
									<textarea
										id="override_comment"
										value={damageFormData.override_comment}
										onChange={(e) => updateDamageFormData('override_comment', e.target.value)}
										className="flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
										placeholder="Explain why you're overriding the AI estimate"
									/>
								</div>
							</>
						)}
					</div>
					<div className="flex justify-end gap-2">
						<Button onClick={() => setOpenDamageModal(0)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 p-3 rounded-lg">
							Cancel
						</Button>
						<Button 
							onClick={async (e) => {
								e.preventDefault();
								try {
									const damageData = {
										claim_id: damageFormData.claim_id,
										vehicle_part: damageFormData.vehicle_part,
										damage_description: damageFormData.damage_description,
										photos: damageFormData.photos,
										estimated_amount_in_cents: damageFormData.estimated_amount_in_cents,
										override_amount_in_cents: hasRejectedEstimate ? parseInt(damageFormData.override_amount_in_cents) : null,
										override_comment: hasRejectedEstimate ? damageFormData.override_comment : null,
										sources: damageFormData.sources
									};
									
									if (editingDamageId) {
										// Update existing damage with resubmitted status
										console.log('Attempting to update damage:', editingDamageId, damageData);
										
										const { data, error } = await supabase
											.from('damages')
											.update({...damageData, status: 'resubmitted'})
											.eq('id', editingDamageId)
											.select();
										
										if (error) {
											console.error('Supabase error details:', {
												message: error.message,
												details: error.details,
												hint: error.hint,
												code: error.code
											});
											throw error;
										}
										
										console.log('Damage updated successfully:', data);
										
										// Create history entry for resubmission
										if (data && data.length > 0) {
											const historyData = {
												damage_id: editingDamageId,
												event_type: 'resubmitted',
												status: 'resubmitted',
												created_by: 'Claims Agent',
												created_at: new Date().toISOString()
											};
											
											const { data: historyEntry, error: historyError } = await supabase
												.from('damage_history')
												.insert([historyData])
												.select();
											
											if (historyError) {
												console.error('Failed to create history entry:', historyError);
											} else if (historyEntry && historyEntry.length > 0) {
												setDamageHistory([...damageHistory, historyEntry[0]]);
											}
											
											// Update the damage in the list
											setDamages(damages.map(d => d.id === editingDamageId ? data[0] : d));
										}
									} else {
										// Create new damage
										console.log('Attempting to insert damage:', damageData);
										
										const { data, error } = await supabase
											.from('damages')
											.insert([damageData])
											.select();
										
										if (error) {
											console.error('Supabase error details:', {
												message: error.message,
												details: error.details,
												hint: error.hint,
												code: error.code
											});
											throw error;
										}
										
										console.log('Damage created successfully:', data);
									
									// Create initial history entry
									if (data && data.length > 0) {
										const historyData = {
											damage_id: data[0].id,
											event_type: 'created',
											status: 'pending',
											created_by: 'Claims Agent',
											created_at: new Date().toISOString()
										};
										
										const { data: historyEntry, error: historyError } = await supabase
											.from('damage_history')
											.insert([historyData])
											.select();
										
										if (historyError) {
											console.error('Failed to create history entry:', historyError);
										} else if (historyEntry && historyEntry.length > 0) {
											setDamageHistory([...damageHistory, historyEntry[0]]);
										}
										
										// Add new damage to the list
										setDamages([...damages, data[0]]);
									}
								}
								
								setOpenDamageModal(0);
							} catch (error) {
								console.error('Error saving damage:', error);
								alert(`Failed to save damage: ${error.message || 'Unknown error'}`);
								}
							}} 
							disabled={
								!damageFormData.vehicle_part || 
								!damageFormData.damage_description || 
								damageFormData.photos.length === 0 ||
								!damageValidated ||
								(!hasAcceptedEstimate && !hasRejectedEstimate) ||
								(hasRejectedEstimate && (!damageFormData.override_amount_in_cents || parseInt(damageFormData.override_amount_in_cents) <= 0 || !damageFormData.override_comment)) ||
								photoValidationIssues.length > 0
							}
							className={cn(
								"p-3 rounded-lg text-white",
								(!damageFormData.vehicle_part || 
								 !damageFormData.damage_description || 
								 damageFormData.photos.length === 0 ||
								 !damageValidated ||
								 (!hasAcceptedEstimate && !hasRejectedEstimate) ||
								 (hasRejectedEstimate && (!damageFormData.override_amount_in_cents || parseInt(damageFormData.override_amount_in_cents) <= 0 || !damageFormData.override_comment)) ||
								 photoValidationIssues.length > 0)
									? "bg-gray-400 cursor-auto"
									: "bg-blue-600 hover:bg-blue-700"
							)}
						>
							{editingDamageId ? 'Update Damage' : 'Add Damage'}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			
			<div className="px-8 py-4">
				{isLoadingClaims ? (
					<div className="flex justify-center items-center py-12">
						<img src={spinnerIcon} alt="Loading" className="w-8 h-8 animate-spin" />
						<span className="ml-3 text-gray-600">Loading claims...</span>
					</div>
				) : claims.length === 0 ? (
					<div className="text-center py-12 text-gray-500">
						<p className="text-lg">No claims yet</p>
						<p className="text-sm mt-2">Create your first claim using the button above</p>
					</div>
				) : (
					<div className="flex flex-col gap-4 w-full">
						{claims.map((claim) => {
							const claimDamages = damages.filter(d => d.claim_id === claim.id);
							const isExpanded = expandedClaims[claim.id];
							
							return (
								<div key={claim.id} className="bg-white rounded-lg shadow border border-gray-200">
									<div className="p-4 flex items-center gap-4">
										{/* Expand Arrow */}
										<button
											onClick={() => toggleClaim(claim.id)}
											className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
										>
											<svg 
												className={cn(
													"w-5 h-5 text-gray-500 transition-transform duration-200",
													isExpanded ? "rotate-90" : ""
												)} 
												fill="none" 
												stroke="currentColor" 
												viewBox="0 0 24 24"
											>
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</button>
										
										{/* User */}
										<div className="flex items-center gap-2 w-48 flex-shrink-0">
											<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
											</svg>
											<span className="text-gray-900 font-medium truncate">{claim.user?.first_name} {claim.user?.last_name}</span>
										</div>
										
										{/* Vehicle */}
										<div className="flex items-center gap-2 w-56 flex-shrink-0">
											<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0h-.01M15 17a2 2 0 104 0m-4 0h-.01M9 17h6" />
											</svg>
											<span className="text-gray-900 truncate">{claim.policy?.make} {claim.policy?.model} ({claim.policy?.year})</span>
										</div>
										
										{/* Location */}
										<div className="flex items-center gap-2 w-64 flex-shrink-0">
											<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
											<span className="text-gray-900 truncate">{claim.location}</span>
										</div>
										
										{/* Description */}
										<div className="flex items-center gap-2 flex-1 min-w-0">
											<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											<span className="text-gray-900 truncate">{claim.description}</span>
										</div>
										
										{/* Created At */}
										<div className="flex items-center gap-2 w-48 flex-shrink-0">
											<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<span className="text-gray-600 text-sm truncate">{new Date(claim.created_at).toLocaleString()}</span>
										</div>
										
										{/* Claim Metrics */}
										<div className="flex gap-2 items-center">
											<div className="px-3 py-1 bg-green-100 rounded-lg flex flex-col">
												<span className="text-xs text-green-600 font-medium">Total Amount</span>
												<span className="text-sm font-semibold text-green-700">
													{formatUSD(claimDamages.reduce((sum, d) => sum + (d.override_amount_in_cents || d.estimated_amount_in_cents || 0), 0))}
												</span>
											</div>
											<div className="px-3 py-1 bg-orange-100 rounded-lg flex flex-col">
												<span className="text-xs text-orange-600 font-medium">Approval Rate</span>
												<span className="text-sm font-semibold text-orange-700">
													{claimDamages.length > 0 
														? ((claimDamages.filter(d => d.status === 'approved').length / claimDamages.length) * 100).toFixed(0) + '%' 
														: '0%'}
												</span>
											</div>
										</div>

										{/* Add Damage Button */}
										<Button 
											onClick={() => {
												setOpenDamageModal(claim.id);
											}}
											className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold cursor-pointer flex-shrink-0 flex items-center gap-2"
										>
											<img src={plusIcon} alt="Plus Icon" className="w-4 h-4" />
											Add Damage
										</Button>
									</div>
									
									{/* Damages List */}
									{isExpanded && claimDamages.length > 0 && (
										<div className="border-t border-gray-200 bg-gray-50">
											{claimDamages.map((damage) => {
												const finalCost = damage.override_amount_in_cents || damage.estimated_amount_in_cents;
												
												return (
													<div key={damage.id} className="p-4 flex items-center gap-4 border-b border-gray-200 last:border-b-0">
														{/* Spacer for alignment */}
														<div className="w-5 flex-shrink-0"></div>
														
														{/* Vehicle Part */}
														<div className="flex items-center gap-2 w-48 flex-shrink-0">
															<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
															</svg>
															<span className="text-gray-900 font-medium truncate">{damage.vehicle_part}</span>
														</div>
														
														{/* Status Badge */}
														<div className="flex items-center gap-2 w-32 flex-shrink-0">
															<span className={cn(
																"px-2 py-1 rounded-full text-xs font-medium",
																damage.status === 'approved' && "bg-green-100 text-green-700",
																damage.status === 'refused' && "bg-red-100 text-red-700",
																damage.status === 'resubmitted' && "bg-blue-100 text-blue-700",
																damage.status === 'pending' && "bg-yellow-100 text-yellow-700"
															)}>
																{damage.status ? damage.status.charAt(0).toUpperCase() + damage.status.slice(1) : 'Pending'}
															</span>
														</div>
														
														{/* Damage Description */}
														<div className="flex items-center gap-2 w-56 flex-shrink-0">
															<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
															</svg>
															<span className="text-gray-700 text-sm truncate">{damage.damage_description}</span>
														</div>
														
														{/* Photos */}
														<div className="flex items-center gap-2 w-64 flex-shrink-0">
															<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
															</svg>
															<div className="flex gap-1">
																{damage.photos?.slice(0, 3).map((photo, idx) => (
																	<img 
																		key={idx}
																		src={photo} 
																		alt={`Damage ${idx + 1}`} 
																		className="w-8 h-8 object-cover rounded border border-gray-300"
																	/>
																))}
																{damage.photos?.length > 3 && (
																	<div className="w-8 h-8 rounded border border-gray-300 bg-gray-200 flex items-center justify-center text-xs text-gray-600">
																		+{damage.photos.length - 3}
																	</div>
																)}
															</div>
														</div>
														
														{/* Cost */}
														<div className="flex items-center gap-2 flex-1 min-w-0">
															<svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
															</svg>
															<div className="flex flex-col">
																<span className="text-gray-900 font-semibold">{formatUSD(finalCost)}</span>
																{damage.override_amount_in_cents && (
																	<span className="text-xs text-orange-600">Manual Override</span>
																)}
															</div>
														</div>
														
														{/* Sources Tag */}
														{damage.sources && damage.sources.length > 0 && (
															<button
																onClick={() => openSourcesDialog(damage.sources)}
																className="flex-shrink-0 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-colors text-xs font-medium"
																title="View data sources"
															>
																{damage.sources.length} {damage.sources.length === 1 ? 'Source' : 'Sources'}
															</button>
														)}
														
														{/* Timeline Button */}
														<Button
															onClick={() => openTimelineDialog(damage.id)}
															className="flex-shrink-0 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium border-0"
														>
															Timeline
														</Button>
														
														{/* Edit Button - Only show if status is refused */}
														{damage.status === 'refused' && (
															<Button
																onClick={() => openEditDamageModal(damage)}
																className="flex-shrink-0 px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-medium border-0 flex items-center gap-1"
																title="Edit damage"
															>
																<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
																</svg>
																Edit
															</Button>
														)}
													</div>
												);
											})}
										</div>
									)}
									
									{/* No damages message */}
									{isExpanded && claimDamages.length === 0 && (
										<div className="p-4 text-center text-gray-500 text-sm border-t border-gray-200 bg-gray-50">
											No damages recorded for this claim yet
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

export default App;
