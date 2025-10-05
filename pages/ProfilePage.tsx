import React, { useState, useEffect } from 'react';
import { getWorkoutHistory, getUserProfile, calculateUserStats, getPersonalRecords, saveUserProfile } from '../services/storageService';
import { UserProfile, Achievement, HistoricalWorkout, ProfileGalleryImage } from '../types';
import { ACHIEVEMENTS_LIST } from '../constants';
import { DumbbellIcon, FlameIcon, TimerIcon, TrophyIcon, LockIcon, StarIcon, CheckSquareIcon, InstagramIcon, EditIcon, ImagePlusIcon, Trash2Icon, XIcon } from '../components/icons';
import ProfilePhotoUploader from '../components/ProfilePhotoUploader';
import PhotoViewerModal from '../components/PhotoViewerModal';


const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [editedProfile, setEditedProfile] = useState<UserProfile>(getUserProfile());
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [personalRecordsCount, setPersonalRecordsCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  const galleryPhotoUploaderRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const history: HistoricalWorkout[] = getWorkoutHistory();
    const prs = getPersonalRecords();
    const stats = calculateUserStats(history);
    const userProfile = getUserProfile();

    const updatedProfile = { ...userProfile, stats };
    setProfile(updatedProfile);
    setEditedProfile(updatedProfile); // Sync edited profile on initial load
    setPersonalRecordsCount(Object.keys(prs).length);
    
    const updatedAchievements = ACHIEVEMENTS_LIST.map(ach => ({
      ...ach,
      unlocked: ach.condition(history, stats, prs)
    }));
    setAchievements(updatedAchievements);
  }, []);

  const handleEditToggle = () => {
      if (!isEditing) {
          setEditedProfile(profile); // Reset changes when entering edit mode
      }
      setIsEditing(!isEditing);
  };
  
  const handleCancelEdit = () => {
      setEditedProfile(profile); // Revert changes
      setIsEditing(false);
  };

  const handleSaveEdit = () => {
      saveUserProfile(editedProfile);
      setProfile(editedProfile);
      setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setEditedProfile(prev => ({ 
          ...prev, 
          [name]: value
      }));
  };
  
  const handlePhotoSelected = (base64: string) => {
      setEditedProfile(prev => ({ ...prev, avatar: base64 }));
  };

  const handleAddGalleryPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage: ProfileGalleryImage = {
          id: crypto.randomUUID(),
          src: event.target?.result as string,
        };
        setEditedProfile(prev => ({
          ...prev,
          gallery: [...prev.gallery, newImage],
        }));
        if (!isEditing) {
          setIsEditing(true);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDeleteGalleryPhoto = (id: string) => {
      setEditedProfile(prev => ({
          ...prev,
          gallery: prev.gallery.filter(img => img.id !== id)
      }));
  }

  const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
    <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg flex items-center gap-4">
      <div className="p-2 bg-blue-100 dark:bg-blue-900/70 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
  
  const filteredAchievements = achievements.filter(ach => {
      if (filter === 'unlocked') return ach.unlocked;
      if (filter === 'locked') return !ach.unlocked;
      return true;
  }).sort((a,b) => (a.unlocked === b.unlocked) ? 0 : a.unlocked ? -1 : 1);
  
  const xpProgress = (profile.xp / profile.xpToNextLevel) * 100;

  return (
    <div className="animate-fade-in space-y-8">
      {viewingImage && <PhotoViewerModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />}
      <input type="file" accept="image/*" ref={galleryPhotoUploaderRef} onChange={handleAddGalleryPhoto} className="hidden" />

      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl relative">
        <div className="flex items-start gap-4 sm:gap-6">
            <ProfilePhotoUploader isEditing={isEditing} currentAvatar={editedProfile.avatar} onPhotoSelected={handlePhotoSelected}/>
            <div className="flex-grow">
              {isEditing ? (
                  <input
                      type="text"
                      name="name"
                      value={editedProfile.name}
                      onChange={handleInputChange}
                      className="text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                  />
              ) : (
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-2">
                  <InstagramIcon className="w-5 h-5 text-gray-400"/>
                  {isEditing ? (
                       <input
                          type="text"
                          name="instagram"
                          value={editedProfile.instagram || ''}
                          onChange={handleInputChange}
                          placeholder="@seuusuario"
                          className="text-gray-500 dark:text-gray-400 bg-transparent border-b-2 border-dashed border-gray-400 focus:outline-none focus:border-blue-500 w-full"
                      />
                  ) : (
                    profile.instagram ? (
                        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            {profile.instagram}
                        </a>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 italic">Adicionar Instagram</p>
                    )
                  )}
              </div>
            </div>
            
        </div>
        {!isEditing && (
            <button onClick={handleEditToggle} className="absolute top-4 right-4 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold py-2 px-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <EditIcon className="w-4 h-4"/>
                <span className="hidden sm:inline">Editar Perfil</span>
            </button>
        )}
         {isEditing && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
                 <button onClick={handleCancelEdit} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold py-2 px-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <XIcon className="w-4 h-4"/>
                    <span className="hidden sm:inline">Cancelar</span>
                </button>
                 <button onClick={handleSaveEdit} className="flex items-center gap-2 bg-green-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-600 transition-colors">
                    <CheckSquareIcon className="w-4 h-4"/>
                    <span className="hidden sm:inline">Salvar</span>
                </button>
            </div>
        )}

        {/* Level and XP */}
        <div className="mt-6">
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-blue-600 dark:text-blue-400">Nível {profile.level}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{profile.xp} / {profile.xpToNextLevel} XP</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${xpProgress}%`}}></div>
            </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<DumbbellIcon className="w-8 h-8 text-blue-500" />} label="Total de Treinos" value={profile.stats.totalWorkouts} />
          <StatCard icon={<FlameIcon className="w-8 h-8 text-blue-500" />} label="Streak Atual" value={profile.stats.currentStreak} />
          <StatCard icon={<TrophyIcon className="w-8 h-8 text-blue-500" />} label="Recordes Pessoais" value={personalRecordsCount} />
          <StatCard icon={<TimerIcon className="w-8 h-8 text-blue-500" />} label="Tempo Treinando" value={`${profile.stats.timeSpent} min`} />
      </div>

       {/* Photo Gallery */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Galeria de Fotos</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                <button 
                    onClick={() => galleryPhotoUploaderRef.current?.click()} 
                    className="aspect-square flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    title="Adicionar foto à galeria"
                >
                    <ImagePlusIcon className="w-8 h-8"/>
                    <span className="text-xs font-semibold mt-1">Adicionar</span>
                </button>

                {editedProfile.gallery.map(image => (
                    <div key={image.id} className="relative group aspect-square">
                        <img 
                            src={image.src} 
                            alt="Foto do progresso" 
                            className="w-full h-full object-cover rounded-lg cursor-pointer"
                            onClick={() => !isEditing && setViewingImage(image.src)}
                        />
                        {isEditing && (
                            <button onClick={() => handleDeleteGalleryPhoto(image.id)} className="absolute top-1 right-1 p-1 bg-red-600/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2Icon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {editedProfile.gallery.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 mt-4">Sua galeria está vazia. Clique para adicionar sua primeira foto!</p>
            )}
       </div>

      {/* Achievements */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Conquistas</h2>
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-semibold rounded-full ${filter === 'all' ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Todas</button>
              <button onClick={() => setFilter('unlocked')} className={`px-4 py-2 text-sm font-semibold rounded-full ${filter === 'unlocked' ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Desbloqueadas</button>
              <button onClick={() => setFilter('locked')} className={`px-4 py-2 text-sm font-semibold rounded-full ${filter === 'locked' ? 'bg-blue-500 text-white' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Bloqueadas</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAchievements.map(ach => (
                  <div key={ach.id} className={`p-4 rounded-xl text-center transition-opacity ${ach.unlocked ? 'border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                      <ach.icon className={`w-10 h-10 mx-auto ${ach.unlocked ? 'text-yellow-500' : 'text-gray-400'}`} />
                      <h3 className={`font-bold mt-2 ${ach.unlocked ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{ach.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ach.unlocked ? ach.description : ach.isSecret ? '???' : ach.description}</p>
                      {!ach.unlocked && <LockIcon className="w-4 h-4 mx-auto mt-2 text-gray-400" />}
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default ProfilePage;